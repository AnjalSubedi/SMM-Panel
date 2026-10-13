import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

test("auth refreshes cached Google configuration without external API calls", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dmnp-auth-test-"));
  process.env.DATABASE_PATH = join(directory, "test.sqlite");
  process.env.BETTER_AUTH_SECRET = "isolated-auth-test-secret-" + randomUUID();
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.AUTH_EMAIL_FROM;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("External network calls are forbidden in this test."); };
  const { getAuth } = await import("../lib/server/auth");
  const { getDb } = await import("../lib/server/db");
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
    getDb().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
