import { existsSync } from "node:fs";
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { adminEmail } = await import("../lib/server/auth");
  const { getDb, closeDb, one } = await import("../lib/server/db");
  try {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email || email !== adminEmail) throw new Error("Supply the configured ADMIN_EMAIL. This command only bootstraps the designated owner.");
    const db = getDb();
    const user = await one<{ id: string; emailVerified: boolean }>(db, 'SELECT id,"emailVerified" FROM "user" WHERE lower(email) = $1', [email]);
    if (!user) throw new Error("Create the owner account first at /register or sign in with Google.");
    if (!user.emailVerified && !process.argv.includes("--confirm-email-ownership")) throw new Error("Use a verified identity, or add --confirm-email-ownership after confirming this is your own account.");
    await db.query('INSERT INTO "appAdmin" ("userId","grantedAt") VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, new Date().toISOString()]);
    console.log("Administrator access granted to the configured owner account.");
  } finally { await closeDb(); }
}
main().catch(() => { console.error("Admin setup failed. Check the owner email, verified account and PostgreSQL setup."); process.exitCode = 1; });
