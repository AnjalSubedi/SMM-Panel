import "server-only";
import { adminEmail } from "./auth";
import { getDb } from "./db";

export function isAdminId(userId: string): boolean {
  const db = getDb();
  if (db.prepare("SELECT userId FROM appAdmin WHERE userId = ?").get(userId)) return true;
  const owner = db.prepare("SELECT email, emailVerified FROM user WHERE id = ?").get(userId) as { email: string; emailVerified: number } | undefined;
  return Boolean(owner && owner.email.toLowerCase() === adminEmail && owner.emailVerified);
}
