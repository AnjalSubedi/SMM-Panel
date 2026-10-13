import { randomUUID } from "node:crypto";
import { Pool } from "pg";
export async function testDatabase() {
  const base = process.env.DMNP_TEST_DATABASE_URL;
  if (!base) throw new Error("Run npm run test:accounts to start isolated PostgreSQL.");
  const url = new URL(base);
  if (url.hostname !== "127.0.0.1" || url.username !== "dmnp_test" || url.pathname !== "/postgres") throw new Error("Tests only accept the isolated local PostgreSQL runner.");
  const name = "dmnp_test_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({ connectionString: base, max: 1 });
  await admin.query('CREATE DATABASE "' + name + '"');
  url.pathname = "/" + name;
  process.env.DATABASE_URL = url.toString();
  const { migrateDatabase } = await import("../../lib/server/migrations");
  await migrateDatabase();
  return { url: url.toString(), async close() {
    const { closeDb } = await import("../../lib/server/db"); await closeDb();
    await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)'); await admin.end();
  } };
}
