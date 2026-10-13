import "server-only";
import { adminEmail } from "./auth";
import { getDb, one } from "./db";
export async function isAdminId(userId: string): Promise<boolean> {
  const row = await one<{ allowed: boolean }>(getDb(), 'SELECT EXISTS (SELECT 1 FROM "appAdmin" WHERE "userId" = $1) OR EXISTS (SELECT 1 FROM "user" WHERE id = $1 AND lower(email) = $2 AND "emailVerified" = true) AS allowed', [userId, adminEmail]);
  return row?.allowed === true;
}
