import { existsSync } from "node:fs";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { getAuth, adminEmail } = await import("../lib/server/auth");
  const { getDb } = await import("../lib/server/db");
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || email !== adminEmail) throw new Error("Supply the configured ADMIN_EMAIL. This command only bootstraps the designated owner.");
  await getAuth();
  const db = getDb();
  const user = db.prepare("SELECT id,emailVerified FROM user WHERE lower(email) = ?").get(email) as { id: string; emailVerified: number } | undefined;
  if (!user) throw new Error("Create the owner account first at /register or sign in with Google.");
  if (!user.emailVerified && !process.argv.includes("--confirm-email-ownership")) throw new Error("Use a verified identity, or explicitly add --confirm-email-ownership after confirming this is your own account.");
  db.prepare("INSERT OR IGNORE INTO appAdmin(userId,grantedAt) VALUES(?,?)").run(user.id, new Date().toISOString());
  console.log("Administrator access granted to the configured owner account.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Admin setup failed."); process.exitCode = 1; });
