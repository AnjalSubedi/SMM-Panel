import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb } from "./db";
import { automaticRetailCatalog, type ProviderService } from "../fulfillmentCatalog";
import { services } from "../services";
import { packages } from "../catalog";

export class ProviderError extends Error {
  constructor(public code: "unavailable" | "rejected" | "balance" | "ambiguous", message: string) { super(message); }
}
export function automationEnabled() { return process.env.FULFILLMENT_MODE !== "manual"; }
export function providerConfigured() { return Boolean(process.env.SUVAKRIO_API_KEY?.trim()); }
export async function providerRequest(action: "services" | "balance" | "add" | "status", fields: Record<string, string | number> = {}): Promise<unknown> {
  const key = process.env.SUVAKRIO_API_KEY?.trim();
  if (!key) throw new ProviderError("unavailable", "Automatic delivery is temporarily unavailable.");
  let response: Response; let value: unknown;
  try {
    const form = new URLSearchParams({ key, action });
    for (const [name, input] of Object.entries(fields)) form.set(name, String(input));
    response = await fetch("https://suvakriosmm.com/api/v2", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    const reader = response.body?.getReader(); if (!reader) throw new Error("Empty provider response");
    const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > 2000000) throw new Error("Oversized provider response"); chunks.push(chunk.value); } }
    finally { if (length > 2000000) await reader.cancel(); reader.releaseLock(); }
    const data = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    value = JSON.parse(new TextDecoder().decode(data));
  } catch { throw new ProviderError(action === "add" ? "ambiguous" : "unavailable", action === "add" ? "The provider's reply was not confirmed. Submission is paused to avoid a duplicate charge." : "The provider is temporarily unavailable. We will check again automatically."); }
  if (!response.ok) throw new ProviderError(action === "add" ? "ambiguous" : "unavailable", "The provider is temporarily unavailable. We will check again automatically.");
  if (value && typeof value === "object" && "error" in value) {
    if (action === "add" && ("order" in value || typeof value.error !== "string" || !value.error.trim())) throw new ProviderError("ambiguous", "The provider reply is unclear. Submission is paused to prevent a duplicate charge.");
    const balance = /balance|funds|credit/i.test(String(value.error));
    throw new ProviderError(balance ? "balance" : "rejected", balance ? "The delivery provider needs funds. Your order is saved and will retry automatically." : "The provider could not accept this order. Undelivered account funds will be returned to the wallet.");
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
    if (!Array.isArray(raw)) throw new ProviderError("unavailable", "The provider catalog is unavailable.");
    const parsed = raw.flatMap(item => { const result = schema.safeParse(item); return result.success && result.data.max >= result.data.min ? [result.data] : []; });
    if (!parsed.length) throw new ProviderError("unavailable", "The provider catalog is unavailable.");
    await getDb().query('INSERT INTO "appProviderCatalog"(id,digest,services,"updatedAt") VALUES(1,$1,$2,NOW()) ON CONFLICT(id) DO UPDATE SET digest=$1,services=$2,"updatedAt"=NOW()', [digest, JSON.stringify(parsed)]);
    return parsed;
  })();
  try { const data = await cache.pending; cache.data = data; cache.at = Date.now(); return data; }
  finally { cache.pending = undefined; }
}
export async function liveRetailCatalog() {
  if (!automationEnabled()) return { services, packages };
  return automaticRetailCatalog(await providerServices());
}
export async function providerBalance() {
  const value = z.object({ balance: z.coerce.number().nonnegative(), currency: z.string() }).safeParse(await providerRequest("balance"));
  if (!value.success || value.data.currency.toUpperCase() !== "NPR") throw new ProviderError("unavailable", "The provider's billing currency could not be confirmed as NPR.");
  return Math.floor(value.data.balance * 100);
}
