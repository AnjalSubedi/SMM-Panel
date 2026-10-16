import "server-only";
import { claimFulfillmentLease, renewFulfillmentLease, releaseFulfillmentLease } from "./fulfillment-lease";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDb, transaction, type Database } from "./db";
import { automationEnabled, providerConfigured, providerServices, providerBalance, providerRequest, ProviderError } from "./suvakrio";
import { fulfillmentSteps, type FulfillmentStep } from "../fulfillmentCatalog";
import { services } from "../services";
import { packages } from "../catalog";
import { readDeliveryPlan } from "../delivery";
import type { OrderRecord } from "../account-types";

export type FulfillmentSummary = { id: string; name: string; quantity: number; state: string; providerOrderId: string | null; providerStatus: string; remains: number | null; refundedPaisa: number; message: string };
type Job = { id: string; orderId: string; step: number; payload: FulfillmentStep; retailPaisa: number; state: string; providerOrderId: string | null; providerStatus: string; remains: number | null; refundedPaisa: number; message: string };
type Scope = { userId?: string; orderId?: string };
const scopeWhere = (scope: Scope, offset = 1) => scope.orderId ? { clause: `o.id=$${offset}`, values: [scope.orderId] } : scope.userId ? { clause: `o."userId"=$${offset}`, values: [scope.userId] } : { clause: "TRUE", values: [] };

export async function saveFulfillmentJobs(db: Database, orderId: string, amountPaisa: number, steps: FulfillmentStep[]) {
  const total = steps.reduce((sum, step) => sum + step.costPaisa, 0);
  if (!steps.length || total > amountPaisa) throw new Error("The provider cost exceeds this order's paid amount.");
  let remainder = amountPaisa;
  for (const [index, payload] of steps.entries()) {
    const retail = index === steps.length - 1 ? remainder : Math.max(1, Math.floor(amountPaisa * payload.costPaisa / total)); remainder -= retail;
    await db.query('INSERT INTO "appFulfillment"(id,"orderId",step,payload,"retailPaisa") VALUES($1,$2,$3,$4,$5) ON CONFLICT("orderId",step) DO NOTHING', [randomUUID(), orderId, index, JSON.stringify(payload), retail]);
  }
}
async function audit(db: Database, orderId: string, action: string, note: string) {
  await db.query('INSERT INTO "appAudit"(id,"actorId",action,"targetId",note,"createdAt") VALUES($1,NULL,$2,$3,$4,$5)', [randomUUID(), action, orderId, note, new Date().toISOString()]);
}
async function updateAggregate(db: Database, orderId: string) {
  const order = (await db.query<OrderRecord>('SELECT * FROM "appOrder" WHERE id=$1 FOR UPDATE', [orderId])).rows[0]; if (!order) return;
  const jobs = (await db.query<Job>('SELECT * FROM "appFulfillment" WHERE "orderId"=$1 ORDER BY step', [orderId])).rows;
  if (!jobs.length || ["awaiting_payment", "payment_rejected", "awaiting_delivery"].includes(order.status)) return;
  for (const job of jobs) {
    const units = job.payload.quantity * job.payload.runs;
    const expectedRefund = job.state === "rejected" || job.state === "cancelled" ? job.retailPaisa : job.state === "partial" && job.remains !== null ? Math.floor(job.retailPaisa * job.remains / units) : 0;
    if (order.userId && expectedRefund > job.refundedPaisa) {
      const credit = expectedRefund - job.refundedPaisa;
      await db.query('INSERT INTO "appWallet"("userId","balancePaisa") VALUES($1,0) ON CONFLICT DO NOTHING', [order.userId]);
      // Locking the order and the ledger's unique source makes credits exactly once.
      const inserted = await db.query('INSERT INTO "appLedger"(id,"userId","amountPaisa",kind,"sourceId","createdAt") VALUES($1,$2,$3,\'refund\',$4,$5) ON CONFLICT("sourceId") DO NOTHING RETURNING id', [randomUUID(), order.userId, credit, "fulfillment-refund:" + job.id, new Date().toISOString()]);
      if (inserted.rowCount) await db.query('UPDATE "appWallet" SET "balancePaisa"="balancePaisa"+$1 WHERE "userId"=$2', [credit, order.userId]);
      await db.query('UPDATE "appFulfillment" SET "refundedPaisa"=$1 WHERE id=$2', [expectedRefund, job.id]);
    }
  }
  const any = (states: string[]) => jobs.some(job => states.includes(job.state));
  const next = any(["unknown"]) ? "needs_attention" : any(["submitting"]) ? "submitting" : any(["ready"]) ? (any(["submitted", "completed"]) ? "submitted" : "queued") : any(["submitted"]) ? (jobs.some(job => /in progress|processing/i.test(job.providerStatus)) ? "processing" : "submitted") : jobs.every(job => job.state === "completed") ? "completed" : any(["completed", "partial"]) ? "partial" : "delivery_failed";
  if (next !== order.status) {
    await db.query('UPDATE "appOrder" SET status=$1,"updatedAt"=$2 WHERE id=$3', [next, new Date().toISOString(), orderId]);
    await audit(db, orderId, "delivery_" + next, "Automatic delivery status: " + next.replaceAll("_", " "));
  }
}
export async function attachFulfillment(orders: OrderRecord[]): Promise<OrderRecord[]> {
  if (!orders.length) return orders;
  const rows = (await getDb().query<Job>('SELECT * FROM "appFulfillment" WHERE "orderId"=ANY($1::text[]) ORDER BY step', [orders.map(order => order.id)])).rows;
  return orders.map(order => ({ ...order, fulfillment: rows.filter(job => job.orderId === order.id).map(job => ({ id: job.id, name: job.payload.name, quantity: job.payload.quantity * job.payload.runs, state: job.state, providerOrderId: job.providerOrderId, providerStatus: job.providerStatus, remains: job.remains, refundedPaisa: job.refundedPaisa, message: job.message })) }));
}
async function initializeOldQueue(db: Database, scope: Scope) {
  const where = scopeWhere(scope);
  const orders = (await db.query<OrderRecord>(`SELECT o.* FROM "appOrder" o WHERE ${where.clause} AND o.status='queued' AND NOT EXISTS(SELECT 1 FROM "appFulfillment" f WHERE f."orderId"=o.id) AND NOT EXISTS(SELECT 1 FROM "appAudit" a WHERE a."targetId"=o.id AND a.action='order_processing') ORDER BY o."createdAt" LIMIT 20`, where.values)).rows;
  if (!orders.length) return;
  const catalog = await providerServices();
  for (const order of orders) {
    const item = services.find(item => item.id === order.itemId) || packages.find(item => item.id === order.itemId);
    try {
      if (!item) throw new Error("Service not mapped");
      const steps = fulfillmentSteps(item, order.quantity, JSON.parse(order.links), catalog, readDeliveryPlan(order.deliveryPlan));
      await db.query("BEGIN");
      await db.query('SELECT id FROM "appOrder" WHERE id=$1 FOR UPDATE', [order.id]);
      await saveFulfillmentJobs(db, order.id, order.amountPaisa, steps);
      await db.query('UPDATE "appOrder" SET "deliveryMessage"=\'\' WHERE id=$1', [order.id]);
      await audit(db, order.id, "delivery_prepared", "Existing paid order prepared for automatic delivery.");
      await db.query("COMMIT");
    } catch {
      await db.query("ROLLBACK");
      await db.query('UPDATE "appOrder" SET status=\'needs_attention\',"updatedAt"=$1 WHERE id=$2 AND status=\'queued\'', [new Date().toISOString(), order.id]);
      await audit(db, order.id, "delivery_needs_attention", "This existing order needs a verified service, separate target links, or a provider-cost review before submission.");
    }
  }
}
async function poll(db: Database, scope: Scope) {
  const where = scopeWhere(scope);
  const jobs = (await db.query<Job>(`SELECT f.* FROM "appFulfillment" f JOIN "appOrder" o ON o.id=f."orderId" WHERE ${where.clause} AND f.state='submitted' AND (f."lastCheckedAt" IS NULL OR f."lastCheckedAt" < NOW()-INTERVAL '30 seconds') LIMIT 50`, where.values)).rows;
  if (!jobs.length) return;
  const raw = await providerRequest("status", { orders: jobs.map(job => job.providerOrderId).join(",") });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ProviderError("unavailable", "Delivery status could not be checked.");
  for (const job of jobs) {
    const result = (raw as Record<string, unknown>)[job.providerOrderId!];
    if (!result || typeof result !== "object") continue;
    if ("error" in result && typeof result.error === "string" && result.error.trim()) {
      await db.query("BEGIN");
      try {
        await db.query(`UPDATE "appFulfillment" SET state='unknown',message='The provider could not confirm this delivery reference. Support is checking it.',"updatedAt"=NOW() WHERE id=$1 AND state='submitted'`, [job.id]);
        await updateAggregate(db, job.orderId); await db.query("COMMIT");
      } catch (error) { await db.query("ROLLBACK"); throw error; }
      continue;
    }
    const parsed = z.object({ status: z.string().max(100), remains: z.preprocess(value => value === null || (typeof value === "string" && !value.trim()) ? undefined : value, z.union([z.number().int().nonnegative(), z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative())]).optional()), currency: z.string().optional() }).safeParse(result);
    if (!parsed.success || (parsed.data.currency && parsed.data.currency.toUpperCase() !== "NPR")) continue;
    const status = parsed.data.status.toLowerCase().replace(/[ _-]/g, "");
    const state = status === "completed" ? "completed" : ["cancelled", "canceled", "refunded"].includes(status) ? "cancelled" : status === "partial" ? "partial" : "submitted";
    const remains = parsed.data.remains ?? null;
    if (state === "partial" && (remains === null || remains > job.payload.quantity * job.payload.runs)) continue;
    const safeStatus = ["pending", "inprogress", "processing", "completed", "cancelled", "canceled", "refunded", "partial"].includes(status) ? parsed.data.status : "Awaiting provider update";
    await db.query("BEGIN");
    try {
      await db.query('UPDATE "appFulfillment" SET state=$1,"providerStatus"=$2,remains=$3,"lastCheckedAt"=NOW(),"updatedAt"=NOW() WHERE id=$4 AND state=\'submitted\'', [state, safeStatus, remains, job.id]);
      await updateAggregate(db, job.orderId); await db.query("COMMIT");
    } catch (error) { await db.query("ROLLBACK"); throw error; }
  }
}
function verifiedJobCost(job: Job, catalog: Awaited<ReturnType<typeof providerServices>>) {
  const total = job.payload.quantity * job.payload.runs;
  const service = catalog.find(service => service.service === job.payload.serviceId);
  if (!service || !/^default$/i.test(service.type) || !Number.isSafeInteger(job.payload.quantity) || job.payload.quantity < service.min || !Number.isSafeInteger(job.payload.runs) || job.payload.runs < 1 || !Number.isSafeInteger(total) || total > service.max || job.payload.billingDivisor !== 1000 || (job.payload.runs > 1 && service.dripfeed === false)) throw new ProviderError("rejected", "This service or quantity is no longer available.");
  const cost = Math.ceil(service.rate * 100 * total / job.payload.billingDivisor);
  if (!Number.isSafeInteger(cost) || cost <= 0 || cost > job.retailPaisa) throw new ProviderError("rejected", "The provider price changed before delivery could start.");
  return cost;
}
async function preflightBundle(db: Database, orderId: string): Promise<boolean> {
  const jobs = (await db.query<Job>('SELECT f.* FROM "appFulfillment" f JOIN "appOrder" o ON o.id=f."orderId" WHERE f."orderId"=$1 AND o."itemKind"=\'package\' ORDER BY f.step', [orderId])).rows;
  // Submitted components cannot be undone. Check a whole untouched package before
  // its first external submission; subsequent work retains per-component checks.
  if (jobs.length < 2 || !jobs.every(job => job.state === "ready" && !job.providerOrderId)) return true;
  try {
    const catalog = await providerServices({ fresh: true });
    const cost = jobs.reduce((sum, job) => sum + verifiedJobCost(job, catalog), 0);
    if (!Number.isSafeInteger(cost) || await providerBalance() < cost) throw new ProviderError("balance", "The provider needs funds for the full package. Your order is saved and will retry automatically.");
    return true;
  } catch (error) {
    const rejected = error instanceof ProviderError && error.code === "rejected";
    const message = rejected ? "A package component is unavailable or its price changed. This package was not started. Account funds will be returned to your wallet." : "Automatic delivery is waiting until the full package can start. Your paid order is saved and will retry automatically.";
    await db.query("BEGIN");
    try {
      await db.query('UPDATE "appFulfillment" SET state=$1,message=$2,"nextAttemptAt"=NOW()+INTERVAL \'5 minutes\',"updatedAt"=NOW() WHERE "orderId"=$3 AND state=\'ready\' AND "providerOrderId" IS NULL', [rejected ? "rejected" : "ready", message, orderId]);
      await updateAggregate(db, orderId);
      await audit(db, orderId, rejected ? "package_preflight_rejected" : "package_preflight_waiting", rejected ? "No package components were submitted; undelivered account funds returned." : "No package components submitted; waiting for full-package availability and balance.");
      await db.query("COMMIT");
    } catch (issue) { await db.query("ROLLBACK"); throw issue; }
    return false;
  }
}
export async function runFulfillment(scope: Scope = {}) {
  if (!automationEnabled() || !providerConfigured()) return;
  const db = await getDb().connect(); let lease: string | null = null;
  const started = Date.now();
  try {
    lease = await claimFulfillmentLease(db);
    if (!lease) return;
    const where = scopeWhere(scope);
    const stranded = (await db.query<Job>(`UPDATE "appFulfillment" f SET state='unknown',message='Submission was interrupted. Check the provider before retrying.',"updatedAt"=NOW() FROM "appOrder" o WHERE o.id=f."orderId" AND ${where.clause} AND f.state='submitting' AND f."leaseUntil" < NOW() RETURNING f.*`, where.values)).rows;
    for (const job of stranded) { await db.query("BEGIN"); await updateAggregate(db, job.orderId); await db.query("COMMIT"); }
    await initializeOldQueue(db, scope);
    try { await poll(db, scope); } catch { console.error("Automatic delivery status temporarily unavailable."); }
    const jobs = (await db.query<Job & { itemKind: string }>(`SELECT f.*,o."itemKind" FROM "appFulfillment" f JOIN "appOrder" o ON o.id=f."orderId" WHERE ${where.clause} AND o.status IN ('queued','submitted','submitting','processing') AND f.state='ready' AND f."nextAttemptAt"<=NOW() ORDER BY f."createdAt",f.step LIMIT 50`, where.values)).rows;
    const bundleChecks = new Map<string, boolean>();
    for (const job of jobs) {
      if (Date.now() - started > 25000 || !await renewFulfillmentLease(db, lease)) break;
      if (job.itemKind === "package") {
        if (!bundleChecks.has(job.orderId)) bundleChecks.set(job.orderId, await preflightBundle(db, job.orderId));
        if (!bundleChecks.get(job.orderId)) continue;
      }
      const total = job.payload.quantity * job.payload.runs;
      try {
        const catalog = await providerServices();
        const cost = verifiedJobCost(job, catalog);
        if (await providerBalance() < cost) throw new ProviderError("balance", "The provider needs funds. Your order will retry automatically.");
      } catch (error) {
        const rejected = error instanceof ProviderError && error.code === "rejected";
        await db.query("BEGIN");
        await db.query('UPDATE "appFulfillment" SET state=$1,message=$2,"nextAttemptAt"=NOW()+INTERVAL \'5 minutes\',"updatedAt"=NOW() WHERE id=$3 AND state=\'ready\'', [rejected ? "rejected" : "ready", error instanceof ProviderError ? error.message : "Automatic delivery is temporarily unavailable. Your order is saved.", job.id]);
        await updateAggregate(db, job.orderId); await db.query("COMMIT"); continue;
      }
      if (Date.now() - started > 40000 || !await renewFulfillmentLease(db, lease)) break;
      const claimed = await db.query('UPDATE "appFulfillment" f SET state=\'submitting\',message=\'\',"leaseUntil"=NOW()+INTERVAL \'2 minutes\',"updatedAt"=NOW() FROM "appOrder" o WHERE f."orderId"=o.id AND o.status IN (\'queued\',\'submitted\',\'submitting\',\'processing\') AND f.id=$1 AND f.state=\'ready\' RETURNING f.id', [job.id]);
      if (!claimed.rowCount) continue;
      await db.query("BEGIN"); await updateAggregate(db, job.orderId); await db.query("COMMIT");
      try {
        const payload = { service: job.payload.serviceId, link: job.payload.link, quantity: job.payload.quantity, ...(job.payload.runs > 1 ? { runs: job.payload.runs, interval: job.payload.interval } : {}) };
        const response = await providerRequest("add", payload);
        const accepted = z.object({ order: z.union([z.number().int().positive(), z.string().regex(/^[1-9][0-9]{0,19}$/)]).transform(String) }).safeParse(response);
        if (!accepted.success) throw new ProviderError("ambiguous", "The provider did not confirm an order reference. We will not submit this order twice.");
        await db.query("BEGIN");
        await db.query('UPDATE "appFulfillment" SET state=\'submitted\',"providerOrderId"=$1,"providerStatus"=\'Pending\',"leaseUntil"=NULL,"lastCheckedAt"=NULL,"updatedAt"=NOW() WHERE id=$2 AND state=\'submitting\'', [accepted.data.order, job.id]);
        await audit(db, job.orderId, "provider_submitted", "Provider order " + accepted.data.order + " accepted for " + total + " units.");
        await updateAggregate(db, job.orderId); await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        const knownRejection = error instanceof ProviderError && ["rejected", "balance"].includes(error.code);
        const balance = error instanceof ProviderError && error.code === "balance";
        await db.query("BEGIN");
        await db.query('UPDATE "appFulfillment" SET state=$1,message=$2,"leaseUntil"=NULL,"nextAttemptAt"=NOW()+INTERVAL \'5 minutes\',"updatedAt"=NOW() WHERE id=$3 AND state=\'submitting\'', [balance ? "ready" : knownRejection ? "rejected" : "unknown", error instanceof ProviderError ? error.message : "The provider submission could not be confirmed. It will not be sent twice.", job.id]);
        await updateAggregate(db, job.orderId); await db.query("COMMIT");
        if (!knownRejection) break;
      }
    }
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    // No request bodies, API keys, target links, or raw provider responses are logged.
    const where = scopeWhere(scope, 2);
    const message = "Automatic delivery is temporarily unavailable. Your paid order is saved and will retry; no additional payment is needed.";
    await db.query(`UPDATE "appOrder" o SET "deliveryMessage"=$1 WHERE ${where.clause} AND o.status='queued'
      AND NOT EXISTS(SELECT 1 FROM "appFulfillment" f WHERE f."orderId"=o.id)`, [message, ...where.values]).catch(() => undefined);
    console.error("Automatic delivery check failed:", error instanceof ProviderError ? error.code : "internal");
  } finally {
    if (lease) await releaseFulfillmentLease(db, lease).catch(() => undefined);
    db.release();
  }
}
export function cronAuthorized(headers: Headers) {
  const secret = process.env.CRON_SECRET?.trim(); const value = headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  return Boolean(secret && Buffer.byteLength(value) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(value), Buffer.from(expected)));
}
export async function reconcileProviderOrder(orderId: string, jobId: string, providerOrderId: string, actorId: string) {
  const { isAdminId } = await import("./permissions");
  if (!await isAdminId(actorId)) throw new Error("Administrator access required");
  // Read-only provider status confirms the reference exists; never adds a new order.
  const status = z.object({ status: z.string() }).safeParse(await providerRequest("status", { order: providerOrderId }));
  if (!status.success) throw new Error("The provider order reference could not be confirmed.");
  await transaction(async db => {
    const changed = await db.query('UPDATE "appFulfillment" SET state=\'submitted\',"providerOrderId"=$1,"providerStatus"=\'Pending\',message=\'\',"lastCheckedAt"=NULL,"updatedAt"=NOW() WHERE id=$2 AND "orderId"=$3 AND state=\'unknown\' RETURNING id', [providerOrderId, jobId, orderId]);
    if (!changed.rowCount) throw new Error("Only uncertain submissions can be reconciled.");
    await db.query('INSERT INTO "appAudit"(id,"actorId",action,"targetId",note,"createdAt") VALUES($1,$2,\'provider_reconciled\',$3,$4,$5)', [randomUUID(), actorId, orderId, "Provider reference confirmed: " + providerOrderId, new Date().toISOString()]);
    await updateAggregate(db, orderId);
  });
}
