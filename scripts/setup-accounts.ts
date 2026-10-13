import { existsSync } from "node:fs";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { getAuth } = await import("../lib/server/auth");
  await getAuth();
  console.log("Account database and authentication tables are ready.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Setup failed."); process.exitCode = 1; });
