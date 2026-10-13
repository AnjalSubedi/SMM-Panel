import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb, many, transaction } from "./db";
import { AppError } from "./errors";
import type { AccountUser, OrderRecord, PaymentRecord } from "../account-types";
import type { AccountNotification, NotificationData } from "../notification-types";

export const notificationReadSchema = z.object({ ids: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(100) }).strict();
const idFor = (...parts: string[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const amount = (paisa: number) => "NPR " + (paisa / 100).toLocaleString("en-NP", { maximumFractionDigits: 2 });
const orderMessages: Record<string, [string, string]> = {
  awaiting_payment: ["Order payment under review", "We received your payment reference. Your order will move forward after verification."],
  payment_rejected: ["Order payment needs attention", "Your payment was not approved. Review the payment details or contact support."],
  awaiting_delivery: ["Payment confirmed. Choose delivery timing", "Your order is paid. Choose default or gradual delivery to release it to the queue."],
  queued: ["Your order is queued", "Your paid order is waiting for dispatch."],
  processing: ["Your order is in progress", "Delivery has started. Check your order for the latest details."],
  completed: ["Your order is complete", "Delivery has been marked complete. Thank you for choosing Digital Marketing NP."],
};
export async function notificationData(user: AccountUser): Promise<NotificationData> {
  const db = getDb();
  const [orders, payments] = await Promise.all([
    many<OrderRecord>(db, 'SELECT * FROM "appOrder" WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 50', [user.id]),
    many<PaymentRecord>(db, 'SELECT * FROM "appPayment" WHERE "userId" = $1 AND kind = $2 ORDER BY COALESCE("reviewedAt", "createdAt") DESC LIMIT 50', [user.id, "topup"]),
  ]);
  const items: AccountNotification[] = [];
  for (const order of orders) {
    const message = orderMessages[order.status];
    if (!message) continue;
    items.push({ id: idFor("order", order.id, order.status, order.updatedAt), kind: "order", title: message[0], description: order.itemName + ". " + message[1], href: "/account#order-" + encodeURIComponent(order.id), createdAt: order.updatedAt, read: false });
  }
  for (const payment of payments) {
    const title = payment.status === "approved" ? "Funds added to your wallet" : payment.status === "rejected" ? "Wallet deposit needs attention" : "Wallet deposit under review";
    const description = payment.status === "approved" ? amount(payment.amountPaisa) + " has been credited to your wallet." : payment.status === "rejected" ? "Your " + amount(payment.amountPaisa) + " deposit was not approved. Check its payment review for details." : "Your " + amount(payment.amountPaisa) + " deposit is awaiting payment verification.";
    const createdAt = payment.reviewedAt || payment.createdAt;
    items.push({ id: idFor("wallet", payment.id, payment.status, createdAt), kind: "wallet", title, description, href: "/account#payment-" + encodeURIComponent(payment.id), createdAt, read: false });
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (items.length) {
    const rows = await many<{ notificationId: string }>(db, 'SELECT "notificationId" FROM "appNotificationRead" WHERE "userId" = $1 AND "notificationId" = ANY($2::text[])', [user.id, items.map(item => item.id)]);
    const read = new Set(rows.map(row => row.notificationId));
    for (const item of items) item.read = read.has(item.id);
  }
  return { items, unreadCount: items.filter(item => !item.read).length, isAdmin: user.isAdmin };
}
export async function markNotificationsRead(raw: unknown, user: AccountUser) {
  const input = notificationReadSchema.parse(raw);
  const own = new Set((await notificationData(user)).items.map(item => item.id));
  if (input.ids.some(id => !own.has(id))) throw new AppError("Notification not found.", 404);
  await transaction(async db => {
    await db.query('INSERT INTO "appNotificationRead" ("userId", "notificationId", "readAt") SELECT $1, id, $3 FROM unnest($2::text[]) AS id ON CONFLICT DO NOTHING', [user.id, [...new Set(input.ids)], new Date().toISOString()]);
  });
  return notificationData(user);
}
