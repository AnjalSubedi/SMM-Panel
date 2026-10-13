import { existsSync } from "node:fs";
import { resolve } from "node:path";
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const filename = process.argv[2];
  if (!filename || !existsSync(filename)) throw new Error("Supply the existing SQLite database path.");
  const { migrateDatabase } = await import("../lib/server/migrations");
  const { importSqlite } = await import("../lib/server/sqlite-import");
  const { closeDb } = await import("../lib/server/db");
  try {
    await migrateDatabase();
    const counts = await importSqlite(resolve(filename));
    console.log("SQLite import completed. Source unchanged; durable rows imported:", counts);
    console.log("Existing users can sign in again with their passwords or Google accounts.");
  } finally { await closeDb(); }
}
main().catch((error) => { console.error("SQLite import failed. Target must be empty and source balances must reconcile. No source rows are changed or credentials logged."); process.exitCode = 1; });
