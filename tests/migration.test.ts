import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testDatabase } from "./helpers/postgres";

test("PostgreSQL migration is repeatable and imports durable SQLite records without overwriting", async () => {
  const database = await testDatabase();
  const directory = mkdtempSync(join(tmpdir(), "dmnp-import-test-"));
  const filename = join(directory, "legacy.sqlite");
  const source = new DatabaseSync(filename);
  const { hashPassword } = await import("better-auth/crypto");
  const password = await hashPassword("Imported-Password-Test-2026");
  source.exec('CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, email TEXT, emailVerified INTEGER, createdAt INTEGER, updatedAt INTEGER); CREATE TABLE account (id TEXT PRIMARY KEY, userId TEXT, accountId TEXT, providerId TEXT, password TEXT, createdAt INTEGER, updatedAt INTEGER, accessToken TEXT, refreshToken TEXT, idToken TEXT); CREATE TABLE appWallet (userId TEXT PRIMARY KEY, balancePaisa INTEGER); CREATE TABLE appLedger (id TEXT PRIMARY KEY, userId TEXT, amountPaisa INTEGER, kind TEXT, sourceId TEXT, createdAt TEXT); CREATE TABLE appOrder (id TEXT PRIMARY KEY, userId TEXT, email TEXT, itemId TEXT, itemKind TEXT, itemName TEXT, quantity INTEGER, amountPaisa INTEGER, links TEXT, method TEXT, status TEXT, requestScope TEXT, requestKey TEXT, createdAt TEXT, updatedAt TEXT)');
  source.prepare('INSERT INTO user VALUES (?,?,?,?,?,?)').run("legacy-user", "Legacy User", "legacy@example.test", 1, 1700000000000, 1700000000000);
  source.prepare('INSERT INTO account (id,userId,accountId,providerId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("legacy-account", "legacy-user", "legacy-user", "credential", password, 1700000000000, 1700000000000);
  source.exec(`INSERT INTO appWallet VALUES ('legacy-user', 50000); INSERT INTO appLedger VALUES ('legacy-ledger', 'legacy-user', 50000, 'deposit', 'legacy-payment', '2026-10-01'); INSERT INTO appOrder VALUES ('legacy-order', 'legacy-user', 'legacy@example.test', 'FB_03', 'service', 'Existing order', 100, 1390, '[]', 'wallet', 'processing', 'legacy', 'legacy', '2026-10-01', '2026-10-01');`);
  source.exec("INSERT INTO account VALUES ('legacy-google','legacy-user','google-identity','google',NULL,1700000000000,1700000000000,'fake-access','fake-refresh','fake-id')");
  source.close();
  try {
    const { migrateDatabase } = await import("../lib/server/migrations");
    const { importSqlite } = await import("../lib/server/sqlite-import");
    const { getDb, one } = await import("../lib/server/db");
    const counts = await importSqlite(filename);
    assert.equal(counts.user, 1); assert.equal(counts.account, 2); assert.equal(counts.appOrder, 1);
    const db = getDb();
    const user = await one(db, 'SELECT * FROM "user" WHERE id = $1', ["legacy-user"]);
    assert.equal(user!.emailVerified, true);
    assert.equal(user!.createdAt.toISOString(), new Date(1700000000000).toISOString());
    const google = await one(db, 'SELECT "accessToken", "refreshToken", "idToken", "accountId" FROM "account" WHERE id = $1', ["legacy-google"]);
    assert.deepEqual(google, { accessToken: null, refreshToken: null, idToken: null, accountId: "google-identity" }, "Import preserves identity without copying unused Google tokens");
    const order = await one(db, 'SELECT * FROM "appOrder" WHERE id = $1', ["legacy-order"]);
    assert.equal(order!.status, "processing"); assert.equal(order!.amountPaisa, 1390);
    assert.equal(order!.deliveryWindowMinutes, 0); assert.equal(order!.deliveryPlan, null);
    await migrateDatabase();
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM "appTermsAcceptance"')).rows[0].count, 0, "Existing orders are not assigned fabricated acceptance");
    assert.equal((await one(db, 'SELECT "balancePaisa" FROM "appWallet" WHERE "userId" = $1', ["legacy-user"]))!.balancePaisa, 50000);
    await assert.rejects(importSqlite(filename), /must be empty/);
    const { getAuth } = await import("../lib/server/auth");
    assert.ok(await (await getAuth()).api.signInEmail({ body: { email: "legacy@example.test", password: "Imported-Password-Test-2026" } }), "Imported password hashes still sign in");
    const unchanged = new DatabaseSync(filename, { readOnly: true });
    assert.equal(unchanged.prepare("SELECT COUNT(*) AS count FROM user").get()!.count, 1); unchanged.close();
  } finally { await database.close(); rmSync(directory, { recursive: true, force: true }); }
});
