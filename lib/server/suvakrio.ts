import "server-only";
import { requestProviderWithPublicDns } from "./provider-dns";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "./db";
import { automaticRetailCatalog, type ProviderService } from "../fulfillmentCatalog";
import { services } from "../services";
import { packages } from "../catalog";

type ProviderDiagnostic = { action?: string; stage?: string; httpStatus?: number; networkCode?: string; currency?: string; reason?: string };
export class ProviderError extends Error {
  constructor(public code: "unavailable" | "rejected" | "balance" | "ambiguous", message: string, public diagnostic: ProviderDiagnostic = {}) { super(message); }
}
function safeCode(error: unknown): string | undefined {
  const value = (error as { cause?: { code?: unknown }; code?: unknown })?.cause?.code ?? (error as { code?: unknown })?.code;
  return typeof value === "string" && /^[A-Z0-9_]{1,64}$/.test(value) ? value : undefined;
}
async function recordCatalogFailure(error: unknown) {
  const note = JSON.stringify(error instanceof ProviderError ? { code: error.code, ...error.diagnostic } : { code: "internal", networkCode: safeCode(error) });
  // Controlled codes only: never persist provider bodies, messages, request forms,
  // URLs, API keys or connection strings. Deduplicate repeated polling failures.
  await getDb().query(`INSERT INTO "appAudit"(id,"actorId",action,"targetId",note,"createdAt")
    SELECT $1,NULL,'provider_connection_failed','provider-connection',$2,$3
    WHERE NOT EXISTS(SELECT 1 FROM "appAudit" WHERE action='provider_connection_failed' AND note=$2 AND "createdAt">$4)`,
    [randomUUID(), note, new Date().toISOString(), new Date(Date.now()-60000).toISOString()]).catch(() => undefined);
  console.error("Provider connection diagnostic:", note);
}
export function automationEnabled() { return process.env.FULFILLMENT_MODE !== "manual"; }
export function providerConfigured() { return Boolean(process.env.SUVAKRIO_API_KEY?.trim()); }
export async function providerRequest(action: "services" | "balance" | "add" | "status", fields: Record<string, string | number> = {}): Promise<unknown> {
  const key = process.env.SUVAKRIO_API_KEY?.trim();
  if (!key) throw new ProviderError("unavailable", "Automatic delivery is temporarily unavailable.");
  let response: Response | undefined; let value: unknown; let stage = "transport";
  try {
    const form = new URLSearchParams({ key, action });
    for (const [name, input] of Object.entries(fields)) form.set(name, String(input));
    const signal = AbortSignal.timeout(15000);
    try { response = await fetch("https://suvakriosmm.com/api/v2", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(), cache: "no-store", redirect: "error", signal }); }
    catch (error) {
      if (safeCode(error) !== "ENOTFOUND") throw error;
      response = await requestProviderWithPublicDns(form.toString(), signal, phase => { stage = phase; });
    }
    stage = "body";
    const reader = response.body?.getReader(); if (!reader) throw new Error("Empty provider response");
    const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > 2000000) throw new Error("Oversized provider response"); chunks.push(chunk.value); } }
    finally { if (length > 2000000) await reader.cancel(); reader.releaseLock(); }
    const data = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    stage = "json";
    value = JSON.parse(new TextDecoder().decode(data));
  } catch (error) { throw new ProviderError(action === "add" ? "ambiguous" : "unavailable", action === "add" ? "The provider's reply was not confirmed. Submission is paused to avoid a duplicate charge." : "The provider is temporarily unavailable. We will check again automatically.", { action, stage, httpStatus: response?.status, networkCode: safeCode(error), reason: stage === "dns_https_request" && error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message.split(key).join("[REDACTED]").replace(/https?:\/\/[^\s]+/g,"[URL]").slice(0,150) : undefined }); }
  if (!response.ok) throw new ProviderError(action === "add" ? "ambiguous" : "unavailable", "The provider is temporarily unavailable. We will check again automatically.", { action, stage: "http", httpStatus: response.status });
  if (value && typeof value === "object" && "error" in value) {
    if (action === "add" && ("order" in value || typeof value.error !== "string" || !value.error.trim())) throw new ProviderError("ambiguous", "The provider reply is unclear. Submission is paused to prevent a duplicate charge.");
    const balance = /balance|funds|credit/i.test(String(value.error));
    const reason = /invalid.*key|key.*invalid|incorrect.*key|key.*incorrect|unauthori[sz]ed|authentication/i.test(String(value.error)) ? "authentication" : /ip.*(allow|restrict|invalid)|whitelist/i.test(String(value.error)) ? "ip_restricted" : "provider_error";
    throw new ProviderError(balance ? "balance" : "rejected", balance ? "The delivery provider needs funds. Your order is saved and will retry automatically." : "The provider could not accept this order. Undelivered account funds will be returned to the wallet.", { action, stage: reason, httpStatus: response.status });
  }
  return value;
}
const schema = z.object({ service: z.coerce.number().int().positive(), name: z.string().min(1).max(1000), type: z.string().min(1), category: z.string().default(""), rate: z.coerce.number().positive(), min: z.coerce.number().int().positive(), max: z.coerce.number().int().positive(), dripfeed: z.boolean().optional() });
const globalState = globalThis as typeof globalThis & { dmnpProviderCatalog?: { digest: string; at: number; data?: ProviderService[]; pending?: Promise<ProviderService[]> } };
export async function providerServices(): Promise<ProviderService[]> {
  const digest = createHash("sha256").update((process.env.SUVAKRIO_API_KEY || "") + (process.env.DATABASE_URL || "")).digest("hex");
  if (!providerConfigured()) throw new ProviderError("unavailable", "Automatic delivery is temporarily unavailable.");
  let cache = globalState.dmnpProviderCatalog;
  if (cache?.digest === digest && cache.pending) return cache.pending;
  if (cache?.digest === digest && cache.data && Date.now() - cache.at < 60000) return cache.data;
  cache = { digest, at: 0 }; globalState.dmnpProviderCatalog = cache;
  cache.pending = (async () => {
    const saved = (await getDb().query<{ services: ProviderService[] }>('SELECT services FROM "appProviderCatalog" WHERE id=1 AND digest=$1 AND "updatedAt" > NOW()-INTERVAL \'60 seconds\'', [digest])).rows[0];
    if (saved) return saved.services;
    await providerBalance(); // Prices are only accepted after confirming NPR billing.
    const raw = await providerRequest("services");
    if (!Array.isArray(raw)) throw new ProviderError("unavailable", "The provider catalog is unavailable.", { action: "services", stage: "catalog_shape" });
    const parsed = raw.flatMap(item => { const result = schema.safeParse(item); return result.success && result.data.max >= result.data.min ? [result.data] : []; });
    if (!parsed.length) throw new ProviderError("unavailable", "The provider catalog is unavailable.", { action: "services", stage: "catalog_schema" });
    await getDb().query('INSERT INTO "appProviderCatalog"(id,digest,services,"updatedAt") VALUES(1,$1,$2,NOW()) ON CONFLICT(id) DO UPDATE SET digest=$1,services=$2,"updatedAt"=NOW()', [digest, JSON.stringify(parsed)]);
    return parsed;
  })();
  try { const data = await cache.pending; cache.data = data; cache.at = Date.now(); return data; }
  catch (error) { await recordCatalogFailure(error); throw error; }
  finally { cache.pending = undefined; }
}
export async function liveRetailCatalog() {
  if (!automationEnabled()) return { services, packages };
  return automaticRetailCatalog(await providerServices());
}
export async function providerBalance() {
  const value = z.object({ balance: z.coerce.number().nonnegative(), currency: z.string() }).safeParse(await providerRequest("balance"));
  if (!value.success || value.data.currency.toUpperCase() !== "NPR") throw new ProviderError("unavailable", "The provider's billing currency could not be confirmed as NPR.", { action: "balance", stage: "balance_schema_or_currency", currency: value.success && /^[A-Z]{3}$/.test(value.data.currency) ? value.data.currency : undefined });
  return Math.floor(value.data.balance * 100);
}
