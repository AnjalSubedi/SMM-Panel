import { termsAcceptance } from "../lib/terms";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { testDatabase } from "./helpers/postgres";
let database: Awaited<ReturnType<typeof testDatabase>>;
process.env.BETTER_AUTH_SECRET = "testing-secret-with-strong-entropy-" + randomUUID();
process.env.ADMIN_EMAIL = "owner@example.test";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

test("wallet, direct payment, admin and identity invariants", async (t) => {
  database = await testDatabase();
  const { getAuth } = await import("../lib/server/auth");
  const { getDb } = await import("../lib/server/db");
  const { createOrder, requestTopup, reviewPayment, accountData, adminData, updateOrderStatus, chooseDelivery } = await import("../lib/server/commerce");
  const { isAdminId } = await import("../lib/server/permissions");
  const { safeNext } = await import("../lib/navigation");
  const auth = await getAuth();
  const db = getDb();
  async function register(email: string, name: string) {
    const result = await auth.api.signUpEmail({ body: { email, name, password: "Long-Test-Passphrase-2026" } });
    return { id: result.user.id, email, name, emailVerified: false, isAdmin: false };
  }
  const owner = await register("owner@example.test", "Owner");
  const customer = await register("customer@example.test", "Customer");
  const outsider = await register("other@example.test", "Outsider");
  const link = [{ platform: "Facebook", url: "https://facebook.com/test-page" }];
  const order = (requestKey = randomUUID()) => ({ ...termsAcceptance(), itemId: "FB_01", quantity: 1250, links: link, method: "wallet", requestKey });
  const deposit = { ...termsAcceptance(), amount: 500, reference: "ESEWA-TEST-001", requestKey: randomUUID() };

  await t.test("owner email alone cannot grant admin access", async () => {
    assert.equal((await isAdminId(owner.id)), false);
    await assert.rejects(async () => (await adminData(customer.id)), /Administrator/);
    await assert.rejects(async () => (await reviewPayment({ paymentId: randomUUID(), decision: "approve", confirmedReceived: true, note: "verified" }, customer.id)), /Administrator/);
    await db.query('UPDATE "user" SET "emailVerified" = TRUE WHERE id = $1', [owner.id]);
    assert.equal((await isAdminId(owner.id)), true);
  });

  let depositId = "";
  await t.test("a deposit remains pending and cannot fund an order until verified", async () => {
    const claim = (await requestTopup(deposit, customer)); depositId = claim.id;
    assert.equal((await accountData(customer)).balancePaisa, 0);
    await assert.rejects(async () => (await createOrder(order(), customer)), /Insufficient/);
    assert.equal((await accountData(customer)).orders.length, 0, "Failed debit rolls back order insertion");
    assert.deepEqual((await requestTopup(deposit, customer)), claim, "Retry is idempotent");
    await assert.rejects(async () => (await requestTopup({ ...termsAcceptance(), ...deposit, requestKey: randomUUID() }, outsider)), /already been submitted/);
  });

  await t.test("admin approval credits once and is audited", async () => {
    await assert.rejects(async () => (await reviewPayment({ paymentId: depositId, decision: "approve", confirmedReceived: false, note: "Verified payment" }, owner.id)), /Confirm/);
    const review = { paymentId: depositId, decision: "approve", confirmedReceived: true, note: "Verified payer and amount" };
    (await reviewPayment(review, owner.id)); (await reviewPayment(review, owner.id));
    assert.equal((await accountData(customer)).balancePaisa, 50000);
    assert.equal((await accountData(customer)).ledger.length, 1);
    assert.equal(Object.getPrototypeOf((await accountData(customer)).ledger[0]), Object.prototype);
    assert.equal(Object.getPrototypeOf((await adminData(owner.id)).payments[0]), Object.prototype);
    assert.equal((await adminData(owner.id)).audit.length, 1);
    await assert.rejects(async () => (await reviewPayment({ ...review, decision: "reject" }, owner.id)), /already reviewed/);
  });

  let walletOrderId = "";
  await t.test("wallet checkout calculates server price and retry never charges twice", async () => {
    const input = order();
    const first = (await createOrder(input, customer)); walletOrderId = first.id;
    const retry = (await createOrder(input, customer));
    assert.equal(first.id, retry.id);
    assert.equal(first.amountPaisa, 18625);
    assert.equal(first.status, "awaiting_delivery");
    (await chooseDelivery({ orderId: first.id, deliveryWindowMinutes: 0 }, customer));
    assert.equal(Object.getPrototypeOf((await accountData(customer)).orders[0]), Object.prototype);
    assert.equal((await accountData(customer)).balancePaisa, 31375);
    assert.equal((await accountData(customer)).ledger.filter((entry) => entry.kind === "order").length, 1);
    await assert.rejects(async () => (await createOrder({ ...termsAcceptance(), ...input, quantity: 1000 }, customer)), /different order/);
    await assert.rejects(async () => (await createOrder({ ...order(), price: 1 }, customer)));
    await assert.rejects(async () => (await createOrder({ ...order(), quantity: 1 }, customer)), /outside/);
    await assert.rejects(async () => (await createOrder({ ...order(), quantity: 1.5 }, customer)));
    await assert.rejects(async () => (await createOrder(order(), null)), /sign in/);
    assert.equal((await accountData(outsider)).orders.length, 0);
  });

  await t.test("concurrent/repeated wallet attempts cannot overspend", async () => {
    const results = await Promise.allSettled([Promise.resolve().then(async () => (await createOrder(order(), customer))), Promise.resolve().then(async () => (await createOrder(order(), customer)))]);
    assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal((await accountData(customer)).balancePaisa, 12750);
  });

  let directId = "";
  await t.test("direct payment bypasses the wallet and cannot complete before verification", async () => {
    const input = { ...order(), method: "direct", reference: "ESEWA-DIRECT-001" };
    const direct = (await createOrder(input, customer)); directId = direct.id;
    assert.equal(direct.status, "awaiting_payment");
    assert.equal((await accountData(customer)).balancePaisa, 12750);
    await assert.rejects(async () => (await updateOrderStatus({ orderId: direct.id, status: "completed", note: "Done" }, owner.id)), /Only paid/);
    assert.equal((await createOrder(input, customer)).id, direct.id);
    const claim = (await accountData(customer)).payments.find((entry) => entry.orderId === direct.id)!;
    (await reviewPayment({ paymentId: claim.id, decision: "approve", confirmedReceived: true, note: "Verified direct payment" }, owner.id));
    assert.equal((await accountData(customer)).orders.find((entry) => entry.id === direct.id)!.status, "awaiting_delivery");
    assert.equal((await accountData(customer)).balancePaisa, 12750);
  });

  await t.test("guest payment, reference reuse, rejected deposits and bundles", async () => {
    const guest = (await createOrder({ ...order(), method: "direct", email: "guest@example.test", reference: "GUEST-REF-001" }, null));
    assert.equal(guest.status, "awaiting_payment");
    await assert.rejects(async () => (await requestTopup({ ...termsAcceptance(), amount: 100, reference: "GUEST-REF-001", requestKey: randomUUID() }, customer)), /already been submitted/);
    const rejected = (await requestTopup({ ...termsAcceptance(), amount: 100, reference: "REJECT-REF-001", requestKey: randomUUID() }, customer));
    (await reviewPayment({ paymentId: rejected.id, decision: "reject", confirmedReceived: false, note: "Payment not received" }, owner.id));
    assert.equal((await accountData(customer)).balancePaisa, 12750);
    await assert.rejects(async () => (await requestTopup({ ...termsAcceptance(), amount: 100.001, reference: "DECIMAL-TEST", requestKey: randomUUID() }, customer)), /decimal/);
    await assert.rejects(async () => (await createOrder({ ...termsAcceptance(), itemId: "COMBO_CREATOR_STARTER", quantity: 1, links: link, method: "direct", email: "guest@example.test", reference: "BUNDLE-REF-1", requestKey: randomUUID() }, null)), /each platform/);
    const bundle = (await createOrder({ ...termsAcceptance(), itemId: "COMBO_CREATOR_STARTER", quantity: 1, links: [...link, { platform: "Instagram", url: "https://instagram.com/test" }], method: "direct", email: "guest@example.test", reference: "BUNDLE-REF-1", requestKey: randomUUID() }, null));
    assert.equal(bundle.amountPaisa, 99900);
    await assert.rejects(async () => (await createOrder({ ...order(), method: "direct", reference: "INVALID-LINK-1", links: [{ platform: "Facebook", url: "javascript:alert(1)" }] }, customer)));
  });

  await t.test("provider minimums are enforced on direct and wallet orders", async () => {
    const flexible = { ...order(), itemId: "FB_05", quantity: 10, method: "direct", reference: "MIN-TEN-VALID" };
    const accepted = (await createOrder(flexible, customer));
    assert.equal(accepted.amountPaisa, 89, "10 units are priced proportionally at the unchanged storefront rate");
    assert.equal((await accountData(customer)).balancePaisa, 12750, "Direct minimum-size order does not debit wallet");
    await assert.rejects(async () => (await createOrder({ ...termsAcceptance(), ...flexible, quantity: 9, requestKey: randomUUID(), reference: "MIN-TEN-LOW" }, customer)), /outside/);
    await assert.rejects(async () => (await createOrder({ ...termsAcceptance(), ...flexible, quantity: 50001, requestKey: randomUUID(), reference: "MIN-TEN-HIGH" }, customer)), /outside/);
    await assert.rejects(async () => (await createOrder({ ...order(), quantity: 10 }, customer)), /outside/, "Facebook page likes + followers requires at least 100");
    const deposit = (await requestTopup({ ...termsAcceptance(), amount: 100, reference: "MIN-TEN-WALLET", requestKey: randomUUID() }, outsider));
    (await reviewPayment({ paymentId: deposit.id, decision: "approve", confirmedReceived: true, note: "Isolated test deposit" }, owner.id));
    const paid = (await createOrder({ ...order(), itemId: "FB_05", quantity: 10 }, outsider));
    assert.equal(paid.amountPaisa, 89);
    assert.equal((await accountData(outsider)).balancePaisa, 9911, "Wallet deducts the exact 10-unit price");
    await assert.rejects(async () => (await createOrder({ ...order(), itemId: "SUV_1901" }, customer)), /does not exist/, "Private provider tests are not orderable");
    await assert.rejects(async () => (await createOrder({ ...order(), itemId: "SUV_1731" }, customer)), /does not exist/, "The storefront keeps its existing service IDs");
  });

  await t.test("paid customers choose timing after approval without a second charge", async () => {
    const input = { ...order(), itemId: "FB_03", quantity: 100, method: "direct", reference: "TIMED-DIRECT-001" };
    const direct = (await createOrder(input, customer));
    const choice = { orderId: direct.id, deliveryWindowMinutes: 60 };
    await assert.rejects(async () => (await chooseDelivery(choice, customer)), /approved/, "Pending payments cannot choose timing");
    await assert.rejects(async () => (await chooseDelivery(choice, outsider)), /not found/, "Only the owner may configure delivery");
    const payment = (await accountData(customer)).payments.find((entry) => entry.orderId === direct.id)!;
    (await reviewPayment({ paymentId: payment.id, decision: "approve", confirmedReceived: true, note: "Simulated payment approved" }, owner.id));
    assert.equal((await accountData(customer)).orders.find((entry) => entry.id === direct.id)!.status, "awaiting_delivery");
    await assert.rejects(async () => (await updateOrderStatus({ orderId: direct.id, status: "processing", note: "Start" }, owner.id)), /Only paid/, "Admin cannot dispatch before the customer's choice");
    const before = (await accountData(customer));
    assert.equal((await chooseDelivery(choice, customer)).status, "queued");
    const saved = (await accountData(customer)).orders.find((entry) => entry.id === direct.id)!;
    assert.equal(saved.deliveryWindowMinutes, 60);
    assert.deepEqual(JSON.parse(saved.deliveryPlan!), { version: 1, durationMinutes: 60, providerServiceId: 1768, totalQuantity: 100, runs: 5, quantityPerRun: 20, intervalMinutes: 15 });
    assert.equal((await chooseDelivery(choice, customer)).id, direct.id, "Retry is idempotent");
    assert.equal((await accountData(customer)).balancePaisa, before.balancePaisa);
    assert.equal((await accountData(customer)).ledger.length, before.ledger.length);
    await assert.rejects(async () => (await chooseDelivery({ ...choice, deliveryWindowMinutes: 120 }, customer)), /already confirmed/);
    await assert.rejects(async () => (await updateOrderStatus({ orderId: direct.id, status: "processing", note: "Start" }, owner.id)), /Confirm/, "Admin must confirm the provider schedule");
    (await updateOrderStatus({ orderId: direct.id, status: "processing", note: "Mock provider schedule configured", scheduleConfirmed: true }, owner.id));

    const funded = (await createOrder({ ...order(), itemId: "FB_03", quantity: 100 }, outsider));
    assert.equal(funded.status, "awaiting_delivery");
    const paidBalance = (await accountData(outsider)).balancePaisa;
    (await chooseDelivery({ orderId: funded.id, deliveryWindowMinutes: 60 }, outsider));
    assert.equal((await accountData(outsider)).balancePaisa, paidBalance, "Wallet payment happens once, before selecting timing");

    const tooSmall = (await createOrder({ ...order(), quantity: 100 }, outsider));
    await assert.rejects(async () => (await chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 60 }, outsider)), /at least 200/);
    assert.equal((await chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 0 }, outsider)).status, "queued");
    await assert.rejects(async () => (await chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 30 }, outsider)));
    await assert.rejects(async () => (await chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 0, runs: 100 }, outsider)), /Unrecognized/);
    const guest = (await createOrder({ ...termsAcceptance(), ...input, email: "guest-timing@example.test", reference: "TIMED-GUEST-001", requestKey: randomUUID() }, null));
    const guestPayment = (await adminData(owner.id)).payments.find((entry) => entry.orderId === guest.id)!;
    (await reviewPayment({ paymentId: guestPayment.id, decision: "approve", confirmedReceived: true, note: "Simulated guest payment" }, owner.id));
    assert.equal((await adminData(owner.id)).orders.find((entry) => entry.id === guest.id)!.status, "queued", "Guest retains original default delivery");
  });

  await t.test("PostgreSQL locks prevent duplicate concurrent approvals, debits and schedule changes", async () => {
    const concurrent = await register("concurrency@example.test", "Concurrent Customer");
    const topup = await requestTopup({ ...termsAcceptance(), amount: 100, reference: "CONCURRENT-DEPOSIT", requestKey: randomUUID() }, concurrent);
    await Promise.all(Array.from({ length: 4 }, () => reviewPayment({ paymentId: topup.id, decision: "approve", confirmedReceived: true, note: "Concurrent simulated approval" }, owner.id)));
    assert.equal((await accountData(concurrent)).balancePaisa, 10000);
    assert.equal((await accountData(concurrent)).ledger.length, 1);
    const input = { ...order(), itemId: "FB_05", quantity: 100 };
    const retries = await Promise.all(Array.from({ length: 5 }, () => createOrder(input, concurrent)));
    assert.equal(new Set(retries.map((entry) => entry.id)).size, 1);
    assert.equal((await accountData(concurrent)).balancePaisa, 9110);
    assert.equal((await accountData(concurrent)).ledger.length, 2);
    const reference = { amount: 100, reference: "CONCURRENT-SAME-REFERENCE" };
    const claims = await Promise.allSettled([requestTopup({ ...termsAcceptance(), ...reference, requestKey: randomUUID() }, concurrent), requestTopup({ ...termsAcceptance(), ...reference, requestKey: randomUUID() }, outsider)]);
    assert.equal(claims.filter((entry) => entry.status === "fulfilled").length, 1);
    const follower = await createOrder({ ...order(), itemId: "FB_03", quantity: 100 }, concurrent);
    const choices = await Promise.allSettled([chooseDelivery({ orderId: follower.id, deliveryWindowMinutes: 0 }, concurrent), chooseDelivery({ orderId: follower.id, deliveryWindowMinutes: 60 }, concurrent)]);
    assert.equal(choices.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal((await accountData(concurrent)).balancePaisa, 7720);
  });

  await t.test("admin status changes are audited; passwords and redirects are safe", async () => {
    (await updateOrderStatus({ orderId: walletOrderId, status: "processing", note: "Provider order 123" }, owner.id));
    (await updateOrderStatus({ orderId: walletOrderId, status: "completed", note: "Provider confirmed complete" }, owner.id));
    await assert.rejects(async () => (await updateOrderStatus({ orderId: walletOrderId, status: "processing", note: "Invalid restart" }, owner.id)), /Only paid/);
    const stored = (await db.query(`SELECT password FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`, [customer.id])).rows[0] as { password: string };
    assert.notEqual(stored.password, "Long-Test-Passphrase-2026");
    assert.ok(stored.password.length > 32);
    assert.equal(safeNext("//evil.test"), "/account");
    assert.equal(safeNext("/\\evil.test"), "/account");
    assert.equal(safeNext("/?resumeOrder=1#calculator"), "/?resumeOrder=1#calculator");
    await assert.rejects(auth.api.signInEmail({ body: { email: customer.email, password: "wrong-password" } }));
    assert.ok(await auth.api.signInEmail({ body: { email: customer.email, password: "Long-Test-Passphrase-2026" } }));
  });
});

after(async () => { if (database) await database.close(); });
