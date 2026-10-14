import "server-only";
import { randomUUID } from "node:crypto";
import type { Database } from "./db";

// Neon/PgBouncer changes backend sessions after a commit. All ownership state
// therefore lives in a row, and every operation is a single atomic statement.
export async function claimFulfillmentLease(db: Database): Promise<string | null> {
  const token = randomUUID();
  const result = await db.query(`INSERT INTO "appFulfillmentWorker"(id,token,"leaseUntil") VALUES(1,$1,NOW()+INTERVAL '2 minutes')
    ON CONFLICT(id) DO UPDATE SET token=EXCLUDED.token,"leaseUntil"=EXCLUDED."leaseUntil"
    WHERE "appFulfillmentWorker"."leaseUntil"<=NOW() RETURNING token`, [token]);
  return result.rowCount ? token : null;
}
export async function renewFulfillmentLease(db: Database, token: string): Promise<boolean> {
  const result = await db.query(`UPDATE "appFulfillmentWorker" SET "leaseUntil"=NOW()+INTERVAL '2 minutes'
    WHERE id=1 AND token=$1 AND "leaseUntil">NOW() RETURNING token`, [token]);
  return Boolean(result.rowCount);
}
export async function releaseFulfillmentLease(db: Database, token: string) {
  await db.query('DELETE FROM "appFulfillmentWorker" WHERE id=1 AND token=$1', [token]);
}
