import "server-only";
import https from "node:https";
import { isIP } from "node:net";

const host = "suvakriosmm.com";
const endpoint = "https://suvakriosmm.com/api/v2";
const resolvers = ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"];
const state = globalThis as typeof globalThis & { dmnpProviderAddress?: { address: string; until: number } };
function publicV4(value: unknown): value is string {
  if (typeof value !== "string" || isIP(value) !== 4) return false;
  const [a,b,c] = value.split(".").map(Number);
  return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a===169 && b===254) && !(a===172 && b>=16 && b<=31) && !(a===192 && b===168) && !(a===100 && b>=64 && b<=127) && !(a===198 && [18,19].includes(b)) && !(a===192 && b===0 && [0,2].includes(c)) && !(a===198 && b===51 && c===100) && !(a===203 && b===0 && c===113);
}
type Diagnostic = (stage: string) => void;
async function resolveAddress(signal: AbortSignal, diagnostic: Diagnostic) {
  if (state.dmnpProviderAddress && state.dmnpProviderAddress.until > Date.now()) return state.dmnpProviderAddress.address;
  for (const resolver of resolvers) {
    signal.throwIfAborted();
    try {
      diagnostic(resolver.includes("cloudflare") ? "dns_cloudflare" : "dns_google");
      // Only the public provider hostname goes to DNS resolvers, never credentials.
      const response = await fetch(resolver + "?name=" + host + "&type=A", { headers: { Accept: "application/dns-json" }, cache: "no-store", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]) });
      if (!response.ok) continue;
      diagnostic("dns_parse");
      const raw = await response.text(); if (raw.length > 16384) continue;
      const data = JSON.parse(raw);
      if (data.Status !== 0 || !Array.isArray(data.Answer)) continue;
      const answer = data.Answer.find((entry: { type?: unknown; data?: unknown }) => entry.type===1 && publicV4(entry.data));
      if (!answer) continue;
      const ttl = Number.isFinite(answer.TTL) ? Math.min(300, Math.max(1, answer.TTL)) : 60;
      state.dmnpProviderAddress = { address: answer.data, until: Date.now()+ttl*1000 };
      return answer.data as string;
    } catch { /* Try the other HTTPS resolver within the original request deadline. */ }
  }
  diagnostic("dns_no_answer");
  throw Object.assign(new Error("Provider DNS resolution failed"), { code: "ENOTFOUND" });
}

// Used ONLY after the normal connection fails DNS lookup, before any request
// reaches the provider. Timeouts, TLS errors and uncertain submissions never retry.
export async function requestProviderWithPublicDns(body: string, signal: AbortSignal, diagnostic: Diagnostic = () => undefined): Promise<Response> {
  const address = await resolveAddress(signal, diagnostic);
  signal.throwIfAborted();
  diagnostic("dns_https_request");
  return new Promise((resolve,reject) => {
    const request = https.request(endpoint, {
      method: "POST", agent: false, servername: host, rejectUnauthorized: true, signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "Content-Length": Buffer.byteLength(body) },
      lookup(hostname, options, callback) {
        if (hostname !== host) { callback(Object.assign(new Error("Unexpected provider hostname"), { code: "ENOTFOUND" }), "", 4); return; }
        callback(null, options.all ? [{ address, family: 4 }] : address, 4);
      },
    }, response => {
      diagnostic("dns_https_response");
      const chunks: Buffer[] = []; let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > 2000000) { response.destroy(); request.destroy(); reject(new Error("Oversized provider response")); return; }
        chunks.push(chunk);
      });
      response.once("error", reject);
      response.once("aborted", () => reject(new Error("Provider response interrupted")));
      response.once("end", () => { try { resolve(new Response(Buffer.concat(chunks), { status: response.statusCode || 502, headers: { "Content-Type": String(response.headers["content-type"] || "application/octet-stream") } })); } catch(error) { reject(error); } });
    });
    request.once("error", reject);
    request.end(body);
  });
}
