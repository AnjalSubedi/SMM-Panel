import "server-only";
import { isIP } from "node:net";
import { createHash } from "node:crypto";
import { getIP } from "better-auth/api";
import { AppError } from "./errors";

export const maxRequestBytes = 20000;
export function authOrigin(): string {
  const configured = process.env.BETTER_AUTH_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Set BETTER_AUTH_URL to the canonical HTTPS site origin.");
  const url = new URL(configured || "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("BETTER_AUTH_URL must be a plain HTTP(S) origin.");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Production BETTER_AUTH_URL must use HTTPS.");
  return url.origin;
}
export function trustedIpHeaders(): string[] {
  // Vercel overwrites this header. Other deployments must not trust client-supplied forwarding headers.
  return process.env.VERCEL === "1" ? ["x-vercel-forwarded-for"] : [];
}
export function guestOrderLimitKey(headers: Headers): string {
  const raw = process.env.VERCEL === "1" ? headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  if (!raw || !isIP(raw)) return "guest-orders:unknown";
  const ip = trustedIpHeaders().length ? getIP(headers, { advanced: { ipAddress: { ipAddressHeaders: trustedIpHeaders() } } }) : null;
  return "guest-orders:" + (ip ? createHash("sha256").update(ip).digest("hex") : "unknown");
}
export async function readLimitedBody(request: Request, limit = maxRequestBytes, timeoutMs = 5000): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new AppError("Invalid Content-Length.", 400);
  if (length !== null && Number(length) > limit) throw new AppError("Request is too large.", 413);
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") throw new AppError("Compressed request bodies are not supported.", 415);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError("Request body timed out.", 408)), timeoutMs);
    onAbort = () => reject(new AppError("Request was interrupted.", 400));
    request.signal.addEventListener("abort", onAbort, { once: true });
    if (request.signal.aborted) onAbort();
  });
  const chunks: Uint8Array[] = []; let total = 0; let complete = false;
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), expired]);
      if (done) { complete = true; break; }
      total += value.byteLength;
      if (total > limit) throw new AppError("Request is too large.", 413);
      chunks.push(value);
    }
    const result = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally {
    clearTimeout(timer); request.signal.removeEventListener("abort", onAbort);
    if (!complete) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
