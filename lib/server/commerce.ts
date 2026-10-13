import { isPublicWebLink } from "../publicLinks";
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, transaction, one, many, lockRequest, type Database } from "./db";
import { AppError } from "./errors";
import { isAdminId } from "./permissions";
import { services } from "../services";
import { packages, type CatalogItem } from "../catalog";
import { supportsGradualDelivery, planDelivery, deliveryLabel } from "../delivery";
import { requiredPlatforms } from "../checkout";
import type { AccountData, AccountUser, AdminData, LedgerRecord, OrderRecord, PaymentRecord, PublicLink } from "../account-types";

const referenceSchema = z.string().trim().min(6, "Enter the eSewa transaction reference (at least 6 characters).").max(64).regex(/^[a-zA-Z0-9-]+$/, "Transaction references can contain letters, numbers and hyphens.").transform((value) => value.toUpperCase());
const linkSchema = z.object({ platform: z.string().min(1).max(40), url: z.string().trim().max(2048).url("Enter a valid public URL.").refine((value) => ["https:", "http:"].includes(new URL(value).protocol), "Use an https:// or http:// URL.") }).strict();

export const orderSchema = z.object({
  itemId: z.string().min(1).max(80),
  quantity: z.number().int().positive(),
  links: z.array(linkSchema).min(1).max(9),
  method: z.enum(["wallet", "direct"]),
  email: z.string().trim().email().max(254).optional(),
  reference: referenceSchema.optional(),
  requestKey: z.string().uuid("Refresh the page and try again."),
}).strict();
export type OrderInput = z.infer<typeof orderSchema>;

export const topupSchema = z.object({
  amount: z.number().min(100, "The minimum deposit is NPR 100.").max(100000, "The maximum deposit is NPR 100,000."),
  reference: referenceSchema,
  requestKey: z.string().uuid(),
}).strict();

export const reviewSchema = z.object({
  paymentId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  confirmedReceived: z.boolean(),
  note: z.string().trim().min(5, "Add a review note.").max(1000),
}).strict();
export const deliverySchema = z.object({
  orderId: z.string().uuid(),
  deliveryWindowMinutes: z.number().int().refine((minutes) => minutes === 0 || (minutes >= 60 && minutes <= 10080), "Choose default delivery or a timeframe from 1 hour to 7 days."),
}).strict();

export const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["processing", "completed"]),
  scheduleConfirmed: z.boolean().optional(),
  note: z.string().trim().min(3).max(1000),
}).strict();

export function amountToPaisa(amount: number): number {
  const value = Math.round(amount * 100);
  if (!Number.isSafeInteger(value) || value <= 0 || Math.abs(amount * 100 - value) > 0.00001) throw new AppError("Use a positive amount with at most two decimal places.");
  return value;
}

function timestamp() { return new Date().toISOString(); }
async function adminOnly(actorId: string) { if (!await isAdminId(actorId)) throw new AppError("Administrator access is required.", 403); }
async function wallet(userId: string, db: Database = getDb()) {
  (await db.query("INSERT INTO \"appWallet\"(\"userId\",\"balancePaisa\") VALUES($1,0) ON CONFLICT DO NOTHING", [userId]));
  return ((await one(db, "SELECT \"balancePaisa\" FROM \"appWallet\" WHERE \"userId\" = $1", [userId])) as { balancePaisa: number }).balancePaisa;
}

function quote(input: OrderInput): { item: CatalogItem; amountPaisa: number; quantity: number; links: PublicLink[] } {
  const item = services.find((entry) => entry.id === input.itemId) || packages.find((entry) => entry.id === input.itemId);
  if (!item) throw new AppError("This service does not exist.");
  const quantity = item.kind === "package" ? 1 : input.quantity;
  if (item.kind === "package" && input.quantity !== 1) throw new AppError("Bundles must use a quantity of one.");
  if (item.kind === "service" && (quantity < (item.min ?? 1) || quantity > (item.max ?? 1))) throw new AppError("The selected quantity is outside this service's limits.");
  const amountPaisa = item.kind === "package" ? amountToPaisa(item.price) : Math.round(amountToPaisa(item.price) * quantity / (item.unitSize ?? 1));
  if (amountPaisa < 1) throw new AppError("The calculated amount is too small.");
  const required = requiredPlatforms(item);
  const supplied = new Map(input.links.map((entry) => [entry.platform, entry.url]));
  if (supplied.size !== input.links.length || required.length !== supplied.size || required.some((platform) => !supplied.has(platform))) throw new AppError("Provide exactly one public link for each platform in this order.");
  if (input.links.some(link => !isPublicWebLink(link.url, link.platform))) throw new AppError("Use a public link from the selected platform, without login details, private addresses or custom ports.");
  return { item, amountPaisa, quantity, links: required.map((platform) => ({ platform, url: supplied.get(platform)! })) };
}

function result(order: OrderRecord) {
  return { id: order.id, status: order.status, amountPaisa: order.amountPaisa, method: order.method };
}

export async function createOrder(raw: unknown, user: AccountUser | null) {
  const input = orderSchema.parse(raw);
  if (input.method === "wallet" && !user) throw new AppError("Please sign in to use your wallet.", 401);
  if (input.method === "direct" && !input.reference) throw new AppError("Enter your eSewa transaction reference.");
  const email = (user?.email || input.email || "").toLowerCase();
  if (!email) throw new AppError("Enter your email so we can identify your order.");
  const priced = quote(input);
  const links = JSON.stringify(priced.links);
  const scope = user ? "user:" + user.id : "guest:" + email;
  return transaction(async (db) => {
    await lockRequest(db, "order:" + scope + ":" + input.requestKey);
    if (input.method === "direct") await lockRequest(db, "reference:" + input.reference!);
    const existing = (await one(db, "SELECT * FROM \"appOrder\" WHERE \"requestScope\" = $1 AND \"requestKey\" = $2", [scope, input.requestKey])) as OrderRecord | undefined;
    if (existing) {
      const reference = (await one(db, "SELECT reference FROM \"appPayment\" WHERE \"orderId\" = $1", [existing.id])) as { reference: string } | undefined;
      if (existing.itemId !== input.itemId || existing.quantity !== priced.quantity || existing.method !== input.method || existing.links !== links || (input.method === "direct" && reference?.reference !== input.reference)) throw new AppError("This request key was already used for a different order.", 409);
      return result(existing);
    }
    if (input.method === "direct" && (await one(db, "SELECT id FROM \"appPayment\" WHERE reference = $1", [input.reference!]))) throw new AppError("This eSewa reference has already been submitted. Contact support if it belongs to you.", 409);
    if (user) await wallet(user.id, db);
    const id = randomUUID();
    const now = timestamp();
    const status = input.method === "wallet" ? (user && supportsGradualDelivery(priced.item) ? "awaiting_delivery" : "queued") : "awaiting_payment";
    (await db.query("INSERT INTO \"appOrder\"(id,\"userId\",email,\"itemId\",\"itemKind\",\"itemName\",quantity,\"amountPaisa\",links,method,status,\"requestScope\",\"requestKey\",\"createdAt\",\"updatedAt\") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)", [id, user?.id ?? null, email, priced.item.id, priced.item.kind, priced.item.name, priced.quantity, priced.amountPaisa, links, input.method, status, scope, input.requestKey, now, now]));
    if (input.method === "wallet") {
      const debit = (await db.query("UPDATE \"appWallet\" SET \"balancePaisa\" = \"balancePaisa\" - $1 WHERE \"userId\" = $2 AND \"balancePaisa\" >= $3", [priced.amountPaisa, user!.id, priced.amountPaisa]));
      if (debit.rowCount !== 1) throw new AppError("Insufficient wallet balance. Add funds or choose direct eSewa payment.", 409);
      (await db.query("INSERT INTO \"appLedger\"(id,\"userId\",\"amountPaisa\",kind,\"sourceId\",\"createdAt\") VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), user!.id, -priced.amountPaisa, "order", id, now]));
    } else {
      (await db.query("INSERT INTO \"appPayment\"(id,\"userId\",\"orderId\",kind,\"amountPaisa\",reference,status,\"createdAt\") VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [randomUUID(), user?.id ?? null, id, "order", priced.amountPaisa, input.reference!, "pending", now]));
    }
    return { id, status, amountPaisa: priced.amountPaisa, method: input.method };
  });
}

export async function requestTopup(raw: unknown, user: AccountUser) {
  const input = topupSchema.parse(raw);
  const amountPaisa = amountToPaisa(input.amount);
  return transaction(async (db) => {
    await lockRequest(db, "topup:" + user.id + ":" + input.requestKey);
    await lockRequest(db, "reference:" + input.reference);
    await wallet(user.id, db);
    const previous = (await one(db, "SELECT * FROM \"appPayment\" WHERE \"userId\" = $1 AND \"requestKey\" = $2", [user.id, input.requestKey])) as PaymentRecord | undefined;
    if (previous) {
      if (previous.reference !== input.reference || previous.amountPaisa !== amountPaisa) throw new AppError("This request key was already used for another deposit.", 409);
      return { id: previous.id, status: previous.status };
    }
    if ((await one(db, "SELECT id FROM \"appPayment\" WHERE reference = $1", [input.reference]))) throw new AppError("This eSewa reference has already been submitted.", 409);
    const id = randomUUID();
    (await db.query("INSERT INTO \"appPayment\"(id,\"userId\",kind,\"amountPaisa\",reference,status,\"requestKey\",\"createdAt\") VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [id, user.id, "topup", amountPaisa, input.reference, "pending", input.requestKey, timestamp()]));
    return { id, status: "pending" };
  });
}

export async function reviewPayment(raw: unknown, actorId: string) {
  await adminOnly(actorId);
  const input = reviewSchema.parse(raw);
  if (input.decision === "approve" && !input.confirmedReceived) throw new AppError("Confirm the exact amount and reference in your merchant eSewa account before approving.");
  return transaction(async (db) => {
    const payment = (await one(db, "SELECT * FROM \"appPayment\" WHERE id = $1 FOR UPDATE", [input.paymentId])) as PaymentRecord | undefined;
    if (!payment) throw new AppError("Payment not found.", 404);
    const status = input.decision === "approve" ? "approved" : "rejected";
    if (payment.status === status) return { id: payment.id, status };
    if (payment.status !== "pending") throw new AppError("This payment was already reviewed.", 409);
    const now = timestamp();
    if (input.decision === "approve" && payment.kind === "topup") {
      if (!payment.userId) throw new AppError("The deposit has no account.", 409);
      await wallet(payment.userId, db);
      (await db.query("UPDATE \"appWallet\" SET \"balancePaisa\" = \"balancePaisa\" + $1 WHERE \"userId\" = $2", [payment.amountPaisa, payment.userId]));
      (await db.query("INSERT INTO \"appLedger\"(id,\"userId\",\"amountPaisa\",kind,\"sourceId\",\"createdAt\") VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), payment.userId, payment.amountPaisa, "deposit", payment.id, now]));
    }
    if (payment.kind === "order") {
      const order = (await one(db, "SELECT * FROM \"appOrder\" WHERE id = $1 FOR UPDATE", [payment.orderId!])) as OrderRecord;
      const service = services.find((item) => item.id === order.itemId);
      const next = input.decision === "reject" ? "payment_rejected" : order.userId && service && supportsGradualDelivery(service) ? "awaiting_delivery" : "queued";
      const update = (await db.query("UPDATE \"appOrder\" SET status = $1, \"updatedAt\" = $2 WHERE id = $3 AND status = 'awaiting_payment'", [next, now, payment.orderId!]));
      if (update.rowCount !== 1) throw new AppError("This order can no longer accept a payment review.", 409);
    }
    (await db.query("UPDATE \"appPayment\" SET status = $1, note = $2, \"reviewedBy\" = $3, \"reviewedAt\" = $4 WHERE id = $5 AND status = 'pending'", [status, input.note, actorId, now, payment.id]));
    (await db.query("INSERT INTO \"appAudit\"(id,\"actorId\",action,\"targetId\",note,\"createdAt\") VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), actorId, "payment_" + status, payment.id, input.note, now]));
    return { id: payment.id, status };
  });
}

export async function updateOrderStatus(raw: unknown, actorId: string) {
  await adminOnly(actorId);
  const input = statusSchema.parse(raw);
  return transaction(async (db) => {
    const order = (await one(db, "SELECT * FROM \"appOrder\" WHERE id = $1 FOR UPDATE", [input.orderId])) as OrderRecord | undefined;
    if (!order) throw new AppError("Order not found.", 404);
    if (order.status === input.status) return { id: order.id, status: order.status };
    if (!["queued", "processing"].includes(order.status)) throw new AppError("Only paid, queued or processing orders can be updated.", 409);
    if (order.deliveryWindowMinutes > 0 && !input.scheduleConfirmed) throw new AppError("Confirm that the customer’s drip-feed schedule is configured with the provider before updating delivery.");
    const now = timestamp();
    (await db.query("UPDATE \"appOrder\" SET status = $1, \"updatedAt\" = $2 WHERE id = $3", [input.status, now, order.id]));
    (await db.query("INSERT INTO \"appAudit\"(id,\"actorId\",action,\"targetId\",note,\"createdAt\") VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), actorId, "order_" + input.status, order.id, input.note, now]));
    return { id: order.id, status: input.status };
  });
}

export async function accountData(user: AccountUser): Promise<AccountData> {
  const db = getDb();
  // Account reads do not create a wallet; payment transactions create it when needed.
  const [balance, orders, payments, ledger] = await Promise.all([
    one<{ balancePaisa: number }>(db, 'SELECT "balancePaisa" FROM "appWallet" WHERE "userId" = $1', [user.id]),
    many<OrderRecord>(db, 'SELECT * FROM "appOrder" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100', [user.id]),
    many<PaymentRecord>(db, 'SELECT id,"userId","orderId",kind,"amountPaisa",reference,status,note,"createdAt","reviewedAt" FROM "appPayment" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100', [user.id]),
    many<LedgerRecord>(db, 'SELECT id,"amountPaisa",kind,"sourceId","createdAt" FROM "appLedger" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100', [user.id]),
  ]);
  return { user, balancePaisa: balance?.balancePaisa ?? 0, deliveryServices: services.filter(supportsGradualDelivery), orders, payments, ledger };
}

export async function adminData(actorId: string): Promise<AdminData> {
  await adminOnly(actorId);
  const db = getDb();
  const [users, payments, orders, audit, totals] = await Promise.all([
    many<AdminData["users"][number]>(db, 'SELECT u.id,u.name,u.email,u."emailVerified",u."createdAt",COALESCE(w."balancePaisa",0) AS "balancePaisa" FROM "user" u LEFT JOIN "appWallet" w ON u.id=w."userId" ORDER BY u."createdAt" DESC LIMIT 100'),
    many<AdminData["payments"][number]>(db, 'SELECT p.id,p."userId",p."orderId",p.kind,p."amountPaisa",p.reference,p.status,p.note,p."createdAt",p."reviewedAt",COALESCE(u.email,o.email) AS email,o."itemName" FROM "appPayment" p LEFT JOIN "user" u ON p."userId"=u.id LEFT JOIN "appOrder" o ON p."orderId"=o.id ORDER BY (p.status=\'pending\') DESC,p."createdAt" DESC LIMIT 100'),
    many<OrderRecord>(db, 'SELECT * FROM "appOrder" ORDER BY "createdAt" DESC LIMIT 100'),
    many<AdminData["audit"][number]>(db, 'SELECT a.id,a.action,a."targetId",a.note,a."createdAt",u.email AS "actorEmail" FROM "appAudit" a JOIN "user" u ON a."actorId"=u.id ORDER BY a."createdAt" DESC LIMIT 100'),
    one<AdminData["totals"]>(db, `SELECT (SELECT COUNT(*)::int FROM "user") AS users,
      (SELECT COUNT(*)::int FROM "appPayment" WHERE status='pending') AS "pendingPayments",
      (SELECT COUNT(*)::int FROM "appOrder" WHERE status IN ('awaiting_delivery','queued','processing')) AS "queuedOrders",
      (SELECT COALESCE(SUM("balancePaisa"),0)::bigint FROM "appWallet") AS "walletLiabilityPaisa"`),
  ]);
  return { users, payments, orders, audit, totals: totals! };
}

export async function chooseDelivery(raw: unknown, user: AccountUser) {
  const input = deliverySchema.parse(raw);
  return transaction(async (db) => {
    const order = (await one(db, "SELECT * FROM \"appOrder\" WHERE id = $1 AND \"userId\" = $2 FOR UPDATE", [input.orderId, user.id])) as OrderRecord | undefined;
    if (!order) throw new AppError("Order not found.", 404);
    if (order.status !== "awaiting_delivery") {
      if (["queued", "processing", "completed"].includes(order.status) && order.deliveryWindowMinutes === input.deliveryWindowMinutes) return result(order);
      throw new AppError(["awaiting_payment", "payment_rejected"].includes(order.status) ? "Your payment must be approved before choosing delivery timing." : "The delivery choice is already confirmed. Contact support to change it.", 409);
    }
    const service = services.find((item) => item.id === order.itemId);
    if (!service) throw new AppError("Contact support to configure delivery for this service.");
    let plan;
    try { plan = planDelivery(service, order.quantity, input.deliveryWindowMinutes); }
    catch (error) { throw new AppError((error as Error).message); }
    const now = timestamp();
    (await db.query("UPDATE \"appOrder\" SET \"deliveryWindowMinutes\" = $1, \"deliveryPlan\" = $2, status = 'queued', \"updatedAt\" = $3 WHERE id = $4 AND status = 'awaiting_delivery'", [input.deliveryWindowMinutes, plan ? JSON.stringify(plan) : null, now, order.id]));
    (await db.query("INSERT INTO \"appAudit\"(id,\"actorId\",action,\"targetId\",note,\"createdAt\") VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), user.id, "delivery_selected", order.id, deliveryLabel(input.deliveryWindowMinutes) + (plan ? "; " + plan.runs + " batches of " + plan.quantityPerRun + " every " + plan.intervalMinutes + " minutes" : ""), now]));
    // The order is already paid: choosing timing never debits or charges again.
    return result({ ...order, status: "queued", deliveryWindowMinutes: input.deliveryWindowMinutes, deliveryPlan: plan ? JSON.stringify(plan) : null });
  });
}
