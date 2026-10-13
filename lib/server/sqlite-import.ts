import "server-only";
import { DatabaseSync } from "node:sqlite";
import { transaction, many, one } from "./db";

const tables = ["user", "account", "appAdmin", "appWallet", "appOrder", "appPayment", "appLedger", "appAudit"] as const;
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';

export async function importSqlite(filename: string) {
  // Only this offline import utility uses SQLite. Application routes use pg.
  const source = new DatabaseSync(filename, { readOnly: true });
  source.exec("BEGIN");
  try {
    const existing = new Set((source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((row) => row.name));
    if (!existing.has("user")) throw new Error("The source is not a Digital Marketing NP account database.");
    const data = new Map(tables.map((table) => [table, existing.has(table) ? source.prepare("SELECT * FROM " + identifier(table)).all() : []]));
    const sourceLedger = new Map<string, number>();
    for (const row of data.get("appLedger")!) sourceLedger.set(String(row.userId), (sourceLedger.get(String(row.userId)) || 0) + Number(row.amountPaisa));
    for (const row of data.get("appWallet")!) if (Number(row.balancePaisa) !== (sourceLedger.get(String(row.userId)) || 0)) throw new Error("Source wallet and ledger balances do not reconcile. Import was not started.");
    return await transaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended('dmnp-sqlite-import', 0))");
      // Lock out writes while checking and importing into an empty target.
      await db.query("LOCK TABLE " + tables.map(identifier).join(", ") + " IN ACCESS EXCLUSIVE MODE");
      for (const table of tables) {
        const count = await one<{ count: number }>(db, "SELECT COUNT(*) AS count FROM " + identifier(table));
        if (count!.count !== 0) throw new Error("The PostgreSQL target must be empty. Existing data is never overwritten.");
      }
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const columns = await many<{ column_name: string; data_type: string }>(db, "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1", [table]);
        const types = new Map(columns.map((column) => [column.column_name, column.data_type]));
        for (const row of data.get(table)!) {
          const names = Object.keys(row).filter((name) => types.has(name));
          const values = names.map((name) => {
            const value = row[name];
            if (table === "account" && row.providerId === "google" && ["accessToken", "refreshToken", "idToken"].includes(name)) return null;
            if (value === null) return null;
            if (types.get(name) === "boolean") return Boolean(value);
            if (types.get(name)?.startsWith("timestamp")) {
              const date = new Date(value as string | number);
              if (Number.isNaN(date.getTime())) throw new Error("A source authentication timestamp is invalid.");
              return date;
            }
            return value;
          });
          await db.query("INSERT INTO " + identifier(table) + " (" + names.map(identifier).join(",") + ") VALUES (" + names.map((_, index) => "$" + (index + 1)).join(",") + ")", values);
        }
        const count = await one<{ count: number }>(db, "SELECT COUNT(*) AS count FROM " + identifier(table));
        if (count!.count !== data.get(table)!.length) throw new Error("Imported row counts did not match; transaction rolled back.");
        counts[table] = count!.count;
      }
      const balances = await many<{ userId: string; balancePaisa: number }>(db, 'SELECT "userId","balancePaisa" FROM "appWallet"');
      for (const row of balances) if (row.balancePaisa !== (sourceLedger.get(row.userId) || 0)) throw new Error("Imported balances did not match; transaction rolled back.");
      // Sessions/reset tokens are intentionally not migrated. Sign in again.
      return counts;
    });
  } finally { source.exec("ROLLBACK"); source.close(); }
}
