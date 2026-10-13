import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/postgres";

test("auth refreshes cached Google configuration without external API calls", async () => {

  process.env.BETTER_AUTH_SECRET = "isolated-auth-test-secret-" + randomUUID();
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.AUTH_EMAIL_FROM;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("External network calls are forbidden in this test."); };
  const database = await testDatabase();
  const { getAuth } = await import("../lib/server/auth");
  try {
    const before = await getAuth();
    assert.ok(!before.options.socialProviders?.google);
    assert.equal(await getAuth(), before, "Unchanged settings reuse the same instance");

    process.env.GOOGLE_CLIENT_ID = "  first-test.apps.googleusercontent.com  ";
    process.env.GOOGLE_CLIENT_SECRET = "  test-only-google-secret  ";
    const [enabled, concurrent] = await Promise.all([getAuth(), getAuth()]);
    assert.notEqual(enabled, before, "Adding credentials replaces the old instance");
    assert.equal(concurrent, enabled, "Concurrent requests share initialization");
    assert.ok(enabled.options.socialProviders?.google);
    const response = await enabled.handler(new Request("http://localhost:3000/api/auth/sign-in/social", {
      method: "POST",
      headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: "/account" }),
    }));
    assert.equal(response.status, 200);
    const data = await response.json();
    const url = new URL(data.url);
    assert.equal(url.hostname, "accounts.google.com");
    assert.equal(url.searchParams.get("client_id"), "first-test.apps.googleusercontent.com");
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/callback/google");

    const maliciousRedirect = await enabled.handler(new Request("http://localhost:3000/api/auth/sign-in/social", {
      method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: "https://evil.invalid" }),
    }));
    assert.equal(maliciousRedirect.status, 403, "OAuth cannot redirect to an arbitrary origin");
    const forgedState = await enabled.handler(new Request("http://localhost:3000/api/auth/callback/google?state=forged-state&code=unused-code"));
    assert.equal(forgedState.status, 302);
    assert.match(forgedState.headers.get("location") || "", /error=/, "Forged state is rejected before any Google token request");

    // Exercise the real OAuth state/callback/session pipeline with a local provider double.
    // Google network and signature verification belong to the provider; this checks our storage hooks.
    const { getDb } = await import("../lib/server/db");
    await getDb().query('DELETE FROM "rateLimit"'); // Only this test's isolated database.
    const context = await enabled.$context;
    const google = context.socialProviders.find(provider => provider.id === "google")!;
    google.validateAuthorizationCode = async () => ({ accessToken: "isolated-google-access", refreshToken: "isolated-google-refresh", idToken: "isolated-google-id" });
    google.getUserInfo = async () => ({ user: { name: "Google Customer", email: "google-customer@example.test", emailVerified: true }, data: { sub: "isolated-google-identity" } });
    google.accountSubject = () => "isolated-google-identity";
    const finish = async (start: Response) => {
      assert.equal(start.status, 200, "Local OAuth authorization starts successfully");
      const authURL = new URL((await start.json()).url);
      const cookie = start.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      const callback = await enabled.handler(new Request("http://localhost:3000/api/auth/callback/google?state=" + encodeURIComponent(authURL.searchParams.get("state")!) + "&code=isolated-code", { headers: { Cookie: cookie } }));
      assert.equal(callback.status, 302); assert.match(callback.headers.get("location") || "", /\/account$/);
      const sessionCookie = callback.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      const session = await enabled.api.getSession({ headers: new Headers({ Cookie: sessionCookie }) });
      assert.equal(session?.user.email, "google-customer@example.test"); assert.equal(session?.user.emailVerified, true);
      return session!.user.id;
    };
    // response.json was read above, so start a fresh authorization flow for each attempt.
    const start = () => enabled.handler(new Request("http://localhost:3000/api/auth/sign-in/social", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ provider: "google", callbackURL: "/account" }) }));
    const googleUser = await finish(await start()); assert.equal(await finish(await start()), googleUser, "Repeat Google sign-in retains the same account");
    const accounts = (await getDb().query('SELECT "accessToken", "refreshToken", "idToken" FROM "account" WHERE "userId" = $1 AND "providerId" = $2', [googleUser, "google"])).rows;
    assert.deepEqual(accounts, [{ accessToken: null, refreshToken: null, idToken: null }]);

    process.env.GOOGLE_CLIENT_SECRET = "rotated-test-only-secret";
    const rotated = await getAuth();
    assert.notEqual(rotated, enabled, "Secret rotation replaces the old instance");
    assert.equal(await getAuth(), rotated);

    delete process.env.GOOGLE_CLIENT_SECRET;
    const disabled = await getAuth();
    assert.ok(!disabled.options.socialProviders?.google, "Incomplete credentials disable the provider");
    process.env.GOOGLE_CLIENT_SECRET = "restored-test-only-secret";
    assert.ok((await getAuth()).options.socialProviders?.google, "Restoring credentials enables Google again");
  } finally {
    globalThis.fetch = originalFetch;
    await database.close();
  }
});
