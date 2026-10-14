import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "./auth";
import { transaction } from "./db";

export async function migrateDatabase() {
  const auth = await getAuth();
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('dmnp-schema-migration', 0))");
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    await db.query(await readFile(resolve("migrations/001-commerce.sql"), "utf8"));
    await db.query(await readFile(resolve("migrations/002-notifications.sql"), "utf8"));
    await db.query(await readFile(resolve("migrations/003-performance.sql"), "utf8"));
    await db.query(await readFile(resolve("migrations/004-security.sql"), "utf8"));
    await db.query(await readFile(resolve("migrations/005-terms.sql"), "utf8"));
    await db.query(await readFile(resolve("migrations/006-fulfillment.sql"), "utf8"));
    await db.query(await readFile(resolve("migrations/007-fulfillment-worker.sql"), "utf8"));
    await db.query('CREATE TABLE IF NOT EXISTS "appMigration" ("id" TEXT PRIMARY KEY, "appliedAt" TEXT NOT NULL)');
    await db.query('INSERT INTO "appMigration" ("id", "appliedAt") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING', ["001-commerce", new Date().toISOString()]);
    await db.query('INSERT INTO "appMigration" ("id", "appliedAt") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING', ["002-notifications", new Date().toISOString()]);
    await db.query('INSERT INTO "appMigration" ("id", "appliedAt") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING', ["003-performance", new Date().toISOString()]);
    await db.query('INSERT INTO "appMigration" ("id", "appliedAt") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING', ["004-security", new Date().toISOString()]);
    await db.query('INSERT INTO "appMigration" ("id", "appliedAt") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING', ["005-terms", new Date().toISOString()]);
    await db.query('INSERT INTO "appMigration" ("id", "appliedAt") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING', ["006-fulfillment", new Date().toISOString()]);
    await db.query('INSERT INTO "appMigration" ("id", "appliedAt") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING', ["007-fulfillment-worker", new Date().toISOString()]);
  });
}
