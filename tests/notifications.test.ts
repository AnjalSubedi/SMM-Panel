import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/postgres";
import type { AccountUser } from "../lib/account-types";
process.env.ADMIN_EMAIL = "owner-notifications@example.test";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "isolated-notifications-secret-" + randomUUID();
test("notifications isolate accounts and preserve read status across payment and order updates", async () => {
  const database = await testDatabase();
  try {
    const { getAuth } = await import("../lib/server/auth");
    const { getDb } = await import("../lib/server/db");
    const { requestTopup, reviewPayment, createOrder, chooseDelivery, updateOrderStatus } = await import("../lib/server/commerce");
    const { notificationData, markNotificationsRead } = await import("../lib/server/notifications");
    const auth = await getAuth();
    async function create(email: string, isAdmin = false): Promise<AccountUser> {
      const result = await auth.api.signUpEmail({ body: { name: "Notification Customer", email, password: "Isolated-Notification-Test-Password!" } });
      return { id: result.user.id, name: result.user.name, email, emailVerified: isAdmin, isAdmin };
    }
    const a = await create("notifications-a@example.test"), b = await create("notifications-b@example.test");
    const admin = await create("owner-notifications@example.test", true);
    await getDb().query('UPDATE "user" SET "emailVerified" = true WHERE id = $1', [admin.id]);
    assert.equal((await notificationData(a)).unreadCount, 0);
    const topup = await requestTopup({ amount: 500, reference: "NOTIFY-" + randomUUID(), requestKey: randomUUID() }, a);
    const pending = await notificationData(a);
    assert.equal(pending.unreadCount, 1);
    assert.match(pending.items[0].title, /under review/);
    assert.equal((await notificationData(b)).items.length, 0);
    await assert.rejects(markNotificationsRead({ ids: [pending.items[0].id] }, b), /not found/);
    assert.equal((await markNotificationsRead({ ids: [pending.items[0].id] }, a)).unreadCount, 0);
    assert.equal((await markNotificationsRead({ ids: [pending.items[0].id] }, a)).unreadCount, 0, "Read retries are idempotent");
    assert.equal((await notificationData(a)).items[0].read, true, "Read state persists across requests");
    await reviewPayment({ paymentId: topup.id, decision: "approve", confirmedReceived: true, note: "Isolated verified payment" }, admin.id);
    const approved = await notificationData(a);
    assert.equal(approved.unreadCount, 1);
    assert.notEqual(approved.items[0].id, pending.items[0].id);
    assert.match(approved.items[0].title, /Funds added/);
    assert.match(approved.items[0].description, /500/);
    const order = await createOrder({ itemId: "FB_01", quantity: 1000, method: "wallet", links: [{ platform: "Facebook", url: "https://facebook.com/notification-test" }], requestKey: randomUUID() }, a);
    assert.equal((await notificationData(a)).unreadCount, 2);
    assert.ok((await notificationData(a)).items.some(item => item.href.endsWith(order.id)));
    await chooseDelivery({ orderId: order.id, deliveryWindowMinutes: 0 }, a);
    await updateOrderStatus({ orderId: order.id, status: "completed", note: "Isolated completion test" }, admin.id);
    const completed = await notificationData(a);
    assert.ok(completed.items.some(item => item.title === "Your order is complete"));
    const ownB = await requestTopup({ amount: 100, reference: "NOTIFY-B-" + randomUUID(), requestKey: randomUUID() }, b);
    assert.ok(ownB.id);
    const bData = await notificationData(b);
    await assert.rejects(markNotificationsRead({ ids: [bData.items[0].id, completed.items[0].id] }, b), /not found/);
    assert.equal((await notificationData(b)).unreadCount, 1, "Mixed foreign/owned IDs cannot partially change read status");
    assert.equal((await markNotificationsRead({ ids: completed.items.map(item => item.id) }, a)).unreadCount, 0);
    assert.equal((await notificationData(b)).unreadCount, 1);
  } finally { await database.close(); }
});
