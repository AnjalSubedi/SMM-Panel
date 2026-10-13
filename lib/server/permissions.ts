import "server-only";
import { adminEmail } from "./auth";
import { getDb, one } from "./db";
export async function isAdminId(userId: string): Promise<boolean> {
  const db = getDb();
  if (await one(db, 'SELECT "userId" FROM "appAdmin" WHERE "userId" = $1', [userId])) return true;
  const owner = await one<{ email: string; emailVerified: boolean }>(db, 'SELECT email, "emailVerified" FROM "user" WHERE id = $1', [userId]);
  return Boolean(owner && owner.email.toLowerCase() === adminEmail && owner.emailVerified);
}
