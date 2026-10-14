import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/postgres";

test("email signup requires a password-bound, expiring, single-use code", async () => {
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.RESEND_API_KEY = "isolated-fake-mail-key";
  process.env.AUTH_EMAIL_FROM = "Digital Marketing NP <accounts@example.test>";
  const originalFetch = globalThis.fetch;
  const messages: { to: string[]; text: string; subject: string }[] = [];
  let mailFails = false;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.resend.com/emails", "Only the mocked email transport may be called");
    if (mailFails) return Response.json({ error: "mock failure" }, { status: 503 });
    messages.push(JSON.parse(String(init?.body)));
    return Response.json({ id: randomUUID() });
  };
  const database = await testDatabase();
  try {
    const { getAuth } = await import("../lib/server/auth");
    const { getDb } = await import("../lib/server/db");
    const { POST } = await import("../app/api/auth/email-code/route");
    const auth = await getAuth(); const db = getDb();
    const email = "email-code-" + randomUUID() + "@example.test";
    const password = "Isolated-Email-Code-Password-2026!";
    const signup = await auth.api.signUpEmail({ body: { email, name: "Email Customer", password }, returnHeaders: true });
    assert.equal(signup.response.token, null);
    assert.equal(signup.response.user.emailVerified, false);
    assert.ok(!signup.headers.getSetCookie().some(cookie => cookie.includes("session_token=")));
    await assert.rejects(auth.api.signInEmail({ body: { email, password } }), /not verified/i);
    // A cookie left over from the old development flow cannot authorize account actions.
    const context = await auth.$context;
    const legacy = await context.internalAdapter.createSession(signup.response.user.id);
    assert.ok(legacy);
    const request = (action: "send" | "verify", code?: string, pw = password, origin = "http://localhost:3000") => POST(new Request("http://localhost:3000/api/auth/email-code", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ action, email, password: pw, ...(code === undefined ? {} : { code }) }) }));
    const latestCode = () => messages.at(-1)!.text.match(/code is: (\d{6})/)![1];
    const clearLimits = async () => { await db.query('DELETE FROM "appLimit"'); };
    const releaseCooldown = async () => { await db.query(`UPDATE "verification" SET "expiresAt" = NOW() - INTERVAL '1 second' WHERE identifier LIKE 'email-code-cooldown:%'`); };
    assert.equal((await request("send", undefined, password, "https://evil.invalid")).status, 403);
    assert.equal((await request("send", undefined, "Wrong-Password-2026!")).status, 401);
    assert.equal(messages.length, 0);
    assert.equal((await request("send")).status, 200);
    const firstCode = latestCode(); assert.equal(messages.length, 1);
    const identifier = "email-verification-otp-" + email;
    const stored = (await db.query('SELECT value, "expiresAt" FROM verification WHERE identifier = $1', [identifier])).rows[0];
    assert.ok(!stored.value.includes(firstCode), "Codes are never stored as plaintext");
    assert.ok(stored.expiresAt.getTime() - Date.now() <= 600000);
    assert.equal((await request("send")).status, 429, "Resend has an enforced rolling cooldown");
    assert.equal(messages.length, 1);
    for (const path of ["/email-otp/verify-email", "/email-otp/check-verification-otp", "/email-otp/send-verification-otp", "/sign-in/email-otp", "/verify-email", "/send-verification-email", "/email-otp/reset-password"]) {
      assert.equal((await auth.handler(new Request("http://localhost:3000/api/auth" + path, { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ email, otp: firstCode, type: "email-verification" }) }))).status, 404, path + " cannot bypass password-bound verification");
    }
    assert.equal((await request("verify", firstCode, "Wrong-Password-2026!")).status, 401, "Mailbox access alone cannot activate someone else's password");
    await clearLimits(); await releaseCooldown();
    assert.equal((await request("send")).status, 200);
    const secondCode = latestCode();
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM verification WHERE identifier = $1', [identifier])).rows[0].count, 1);
    if (firstCode !== secondCode) assert.equal((await request("verify", firstCode)).status, 400, "Resending replaces the previous code");
    await db.query(`UPDATE verification SET "expiresAt" = NOW() - INTERVAL '1 second' WHERE identifier = $1`, [identifier]);
    assert.equal((await request("verify", secondCode)).status, 400, "Expired code is rejected");
    await releaseCooldown(); assert.equal((await request("send")).status, 200);
    const thirdCode = latestCode(); const wrong = thirdCode === "000000" ? "111111" : "000000";
    await clearLimits();
    for (let i = 0; i < 5; i++) assert.equal((await request("verify", wrong)).status, 400);
    assert.equal((await request("verify", thirdCode)).status, 400, "Five bad attempts invalidate the code");
    assert.equal((await db.query('SELECT "emailVerified" FROM "user" WHERE id = $1', [signup.response.user.id])).rows[0].emailVerified, false);
    await clearLimits(); await releaseCooldown();
    mailFails = true; assert.equal((await request("send")).status, 503, "Delivery failures are surfaced without claiming success"); mailFails = false;
    await releaseCooldown(); assert.equal((await request("send")).status, 200);
    const finalCode = latestCode();
    const outcomes = await Promise.all([request("verify", finalCode), request("verify", finalCode)]);
    assert.equal(outcomes.filter(response => response.status === 200).length, 1, "Concurrent verification consumes the code once");
    assert.equal((await db.query('SELECT "emailVerified" FROM "user" WHERE id = $1', [signup.response.user.id])).rows[0].emailVerified, true);
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM session WHERE "userId" = $1', [signup.response.user.id])).rows[0].count, 0, "Legacy unverified sessions are revoked");
    assert.equal((await request("verify", finalCode)).status, 409);
    const login = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
    const headers = new Headers({ Cookie: login.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ") });
    assert.equal((await auth.api.getSession({ headers }))?.user.emailVerified, true);
    assert.equal((await request("send")).status, 200); assert.equal(messages.length, 4, "Verified accounts receive no extra verification email");
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
    assert.match(messages.at(-1)!.text, /reset-password/);
    // Production must still permit verified password login without a sender.
    delete process.env.RESEND_API_KEY; delete process.env.AUTH_EMAIL_FROM;
    const offlineMailAuth = await getAuth();
    assert.equal((await offlineMailAuth.api.signInEmail({ body: { email, password } })).user.emailVerified, true);
    assert.equal((await request("send")).status, 503);
  } finally { globalThis.fetch = originalFetch; await database.close(); }
});
