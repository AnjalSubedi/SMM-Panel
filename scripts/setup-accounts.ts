import { existsSync } from "node:fs";
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { migrateDatabase } = await import("../lib/server/migrations");
  const { closeDb } = await import("../lib/server/db");
  try { await migrateDatabase(); console.log("PostgreSQL authentication and commerce tables are ready."); }
  finally { await closeDb(); }
}
main().catch(() => { console.error("PostgreSQL setup failed. Check DATABASE_URL, network access and database permissions. No credentials are logged."); process.exitCode = 1; });
