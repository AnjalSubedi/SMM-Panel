import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authOrigin, guestOrderLimitKey, readLimitedBody } from "../lib/server/request-security";
import { isPublicWebLink } from "../lib/publicLinks";
import { api, body, rateLimit } from "../lib/server/http";
import { testDatabase } from "./helpers/postgres";

const rejectedStatus = (status: number) => (error: unknown) => !!error && typeof error === "object" && "status" in error && error.status === status;
function restore(name: string, value: string | undefined) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }

test("request bodies are bounded while streaming, including multibyte and slow bodies", async () => {
  let cancelled = false; let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(8000)); }, cancel() { cancelled = true; } });
  const request = new Request("http://localhost:3000/api/orders", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readLimitedBody(request), rejectedStatus(413));
  assert.ok(cancelled && pulls <= 5, "Oversized streams stop before buffering the entire request");
  const bytes = new TextEncoder().encode("💙".repeat(6000));
  await assert.rejects(readLimitedBody(new Request(request.url, { method: "POST", body: bytes })), rejectedStatus(413));
  await assert.rejects(readLimitedBody(new Request(request.url, { method: "POST", body: "{}", headers: { "Content-Length": "20001" } })), rejectedStatus(413));
  await assert.rejects(readLimitedBody(new Request(request.url, { method: "POST", body: "{}", headers: { "Content-Encoding": "gzip" } })), rejectedStatus(415));
  const slow = new ReadableStream<Uint8Array>({ start() {} });
  await assert.rejects(readLimitedBody(new Request(request.url, { method: "POST", body: slow, duplex: "half" } as RequestInit), 20000, 25), rejectedStatus(408));
  const valid = await readLimitedBody(new Request(request.url, { method: "POST", body: '{"ok":true}' }));
  assert.equal(new TextDecoder().decode(valid), '{"ok":true}');
});
test("JSON mutations reject missing or foreign origins, wrong media types and malformed bytes", async () => {
  const previous = process.env.BETTER_AUTH_URL; process.env.BETTER_AUTH_URL = "http://localhost:3000";
  const make = (origin?: string, type = "application/json", value: string | Uint8Array = "{}") => new Request("http://localhost:3000/api/orders", { method: "POST", headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": type }, body: value as BodyInit });
  try {
    await assert.rejects(body(make(), z.object({})), rejectedStatus(403));
    await assert.rejects(body(make("https://evil.invalid"), z.object({})), rejectedStatus(403));
    await assert.rejects(body(make("http://localhost:3000", "application/json-evil"), z.object({})), rejectedStatus(415));
    await assert.rejects(body(make("http://localhost:3000", "application/json", new Uint8Array([255])), z.object({})), rejectedStatus(400));
    assert.deepEqual(await body(make("http://localhost:3000", "application/json; charset=utf-8"), z.object({})), {});
  } finally { restore("BETTER_AUTH_URL", previous); }
});
test("production auth requires a canonical HTTPS origin and never accepts origin credentials", () => {
  const environment = process.env.NODE_ENV; const previous = process.env.BETTER_AUTH_URL;
  try {
    Object.assign(process.env, { NODE_ENV: "production" }); delete process.env.BETTER_AUTH_URL;
    assert.throws(authOrigin, /BETTER_AUTH_URL/);
    for (const value of ["http://example.com", "https://user:password@example.com", "https://example.com/path", "https://example.com?bad=1"]) {
      process.env.BETTER_AUTH_URL = value; assert.throws(authOrigin);
    }
    process.env.BETTER_AUTH_URL = "https://www.digitalmarketingnp.me/"; assert.equal(authOrigin(), "https://www.digitalmarketingnp.me");
    process.env.BETTER_AUTH_URL = "http://localhost:3002"; assert.equal(authOrigin(), "http://localhost:3002", "Explicit loopback origins permit isolated production QA");
  } finally { restore("NODE_ENV", environment); restore("BETTER_AUTH_URL", previous); }
});
test("guest buckets trust only Vercel's header, isolate clients and normalize IPv6 subnets", () => {
  const original = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    assert.equal(guestOrderLimitKey(new Headers({ "x-forwarded-for": "192.0.2.1", "x-vercel-forwarded-for": "192.0.2.1" })), "guest-orders:unknown");
    process.env.VERCEL = "1";
    const key = (ip: string) => guestOrderLimitKey(new Headers({ "x-vercel-forwarded-for": ip, "x-forwarded-for": "198.51.100.200" }));
    assert.notEqual(key("192.0.2.1"), key("192.0.2.2")); assert.equal(key("192.0.2.1"), key("::ffff:192.0.2.1"));
    assert.equal(key("2001:db8:1234:5678::1"), key("2001:db8:1234:5678::2"));
    assert.notEqual(key("2001:db8:1234:5678::1"), key("2001:db8:1234:5679::1"));
    assert.equal(key("192.0.2.1, 192.0.2.2"), "guest-orders:unknown"); assert.equal(key("invalid"), "guest-orders:unknown");
    assert.ok(!key("192.0.2.1").includes("192.0.2.1"), "Raw addresses are not stored in limit keys");
  } finally { restore("VERCEL", original); }
});
test("public order links block credentials, private addresses and deceptive social domains", () => {
  for (const value of ["javascript:alert(1)", "https://facebook.com@evil.com/a", "https://facebook.com.evil.com/a", "https://evil.com/a", "http://127.1/a", "http://2130706433", "http://[::1]", "http://localhost", "http://private.internal/a", "https://facebook.com:8080/a"]) assert.equal(isPublicWebLink(value, "Facebook"), false, value);
  for (const [value, platform] of [["https://www.facebook.com/a", "Facebook"], ["https://youtu.be/abc", "YouTube"], ["https://vm.tiktok.com/abc", "TikTok"], ["https://open.spotify.com/track/abc", "Spotify"], ["https://t.me/example", "Telegram"], ["https://example.com/page", "Web & Discord"]]) assert.equal(isPublicWebLink(value, platform), true, value);
});
test("auth profile validation, token minimization, secret rotation and rate-limit isolation", async () => {
  const database = await testDatabase();
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  try {
    const { getAuth } = await import("../lib/server/auth"); const { getDb } = await import("../lib/server/db"); const { migrateDatabase } = await import("../lib/server/migrations");
    const auth = await getAuth(); const db = getDb(); const email = "security-" + randomUUID() + "@example.test";
    const registration = await auth.api.signUpEmail({ body: { name: "Security Customer", email, password: "Isolated-Security-Password-2026" }, returnHeaders: true });
    const userId = registration.response.user.id;
    const cookie = registration.headers.getSetCookie().map(value => value.split(";")[0]).join("; "); const headers = new Headers({ Cookie: cookie, Origin: authOrigin() });
    assert.ok((await auth.api.getSession({ headers }))?.user.id);
    await assert.rejects(auth.api.updateUser({ headers, body: { name: "x".repeat(81) } }), /display name/);
    await assert.rejects(auth.api.updateUser({ headers, body: { image: "javascript:alert(1)" } }), /profile image/);
    const context = await auth.$context;
    const account = await context.internalAdapter.createAccount({ userId, providerId: "google", accountId: "google-test-identity", accessToken: "fake-access-token", refreshToken: "fake-refresh-token", idToken: "fake-id-token" });
    const stored = async () => (await db.query('SELECT "accessToken", "refreshToken", "idToken", "accountId", "userId" FROM "account" WHERE id = $1', [account.id])).rows[0];
    assert.deepEqual(await stored(), { accessToken: null, refreshToken: null, idToken: null, accountId: "google-test-identity", userId });
    await context.internalAdapter.updateAccount(account.id, { accessToken: "new-fake-access-token", refreshToken: "new-fake-refresh-token", idToken: "new-fake-id-token" });
    assert.equal((await stored()).accessToken, null, "Token refresh/update cannot retain unused credentials");
    await db.query('UPDATE "account" SET "accessToken" = $1, "refreshToken" = $2, "idToken" = $3 WHERE id = $4', ["old-access", "old-refresh", "old-id", account.id]);
    await migrateDatabase(); assert.equal((await stored()).refreshToken, null); assert.equal((await stored()).accountId, "google-test-identity", "Migration preserves Google identity binding");
    const key = "security:" + randomUUID();
    await Promise.all([rateLimit(key, 2), rateLimit(key, 2)]); await assert.rejects(rateLimit(key, 2), rejectedStatus(429));
    await rateLimit(key + ":other", 2);
    await db.query('UPDATE "appLimit" SET count = 2147483647 WHERE key = $1', [key]); await assert.rejects(rateLimit(key, 2), rejectedStatus(429));
    const limited = await api(() => rateLimit(key, 2).then(() => new Response())); assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get("Retry-After")) > 0);
    process.env.BETTER_AUTH_SECRET = "rotated-isolated-security-secret-" + randomUUID();
    assert.equal(await (await getAuth()).api.getSession({ headers }), null, "Rotated secret rejects the previous session cookie");
  } finally { restore("BETTER_AUTH_SECRET", originalSecret); await database.close(); }
});
