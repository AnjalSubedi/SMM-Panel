import "server-only";
import { createHash } from "node:crypto";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

types.setTypeParser(20, (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Database integer exceeds the safe numeric range.");
  return number;
});
const state = globalThis as typeof globalThis & { dmnpPgPool?: Pool; dmnpPgPoolKey?: string };
export function getDb(): Pool {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("Set DATABASE_URL to your PostgreSQL connection string, then run npm run accounts:setup.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("DATABASE_URL must be a valid PostgreSQL connection string."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use postgres:// or postgresql://.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const key = createHash("sha256").update(value).digest("hex");
  if (!state.dmnpPgPool || state.dmnpPgPoolKey !== key) {
    // Verify TLS for remote providers. Connection strings cannot turn it off.
    if (!local) for (const option of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(option);
    const pool = new Pool({ connectionString: url.toString(), max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, allowExitOnIdle: true, ...(local ? {} : { ssl: { rejectUnauthorized: true } }) });
    pool.on("error", () => console.error("PostgreSQL idle connection failed."));
    const previous = state.dmnpPgPool;
    state.dmnpPgPool = pool; state.dmnpPgPoolKey = key;
    if (previous) void previous.end().catch(() => undefined);
  }
  return state.dmnpPgPool;
}
export async function closeDb() {
  const pool = state.dmnpPgPool;
  state.dmnpPgPool = undefined; state.dmnpPgPoolKey = undefined;
  if (pool) await pool.end();
}
export type Database = Pool | PoolClient;
export async function one<T extends QueryResultRow = QueryResultRow>(db: Database, sql: string, values: unknown[] = []): Promise<T | undefined> {
  return (await db.query<T>(sql, values)).rows[0];
}
export async function many<T extends QueryResultRow = QueryResultRow>(db: Database, sql: string, values: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, values)).rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])) as T);
}
export async function transaction<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
export async function lockRequest(db: PoolClient, key: string) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
}
