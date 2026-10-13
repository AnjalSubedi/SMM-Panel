import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const directory = mkdtempSync(join(tmpdir(), "dmnp-test-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");
process.env.BETTER_AUTH_SECRET = "testing-secret-with-strong-entropy-" + randomUUID();
process.env.ADMIN_EMAIL = "owner@example.test";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

test("wallet, direct payment, admin and identity invariants", async (t) => {
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
  const order = (requestKey = randomUUID()) => ({ itemId: "FB_01", quantity: 1250, links: link, method: "wallet", requestKey });
  const deposit = { amount: 500, reference: "ESEWA-TEST-001", requestKey: randomUUID() };

  await t.test("owner email alone cannot grant admin access", () => {
    assert.equal(isAdminId(owner.id), false);
    assert.throws(() => adminData(customer.id), /Administrator/);
    assert.throws(() => reviewPayment({ paymentId: randomUUID(), decision: "approve", confirmedReceived: true, note: "verified" }, customer.id), /Administrator/);
    db.prepare("UPDATE user SET emailVerified = 1 WHERE id = ?").run(owner.id);
    assert.equal(isAdminId(owner.id), true);
  });

  let depositId = "";
  await t.test("a deposit remains pending and cannot fund an order until verified", () => {
    const claim = requestTopup(deposit, customer); depositId = claim.id;
    assert.equal(accountData(customer).balancePaisa, 0);
    assert.throws(() => createOrder(order(), customer), /Insufficient/);
    assert.equal(accountData(customer).orders.length, 0, "Failed debit rolls back order insertion");
    assert.deepEqual(requestTopup(deposit, customer), claim, "Retry is idempotent");
    assert.throws(() => requestTopup({ ...deposit, requestKey: randomUUID() }, outsider), /already been submitted/);
  });

  await t.test("admin approval credits once and is audited", () => {
    assert.throws(() => reviewPayment({ paymentId: depositId, decision: "approve", confirmedReceived: false, note: "Verified payment" }, owner.id), /Confirm/);
    const review = { paymentId: depositId, decision: "approve", confirmedReceived: true, note: "Verified payer and amount" };
    reviewPayment(review, owner.id); reviewPayment(review, owner.id);
    assert.equal(accountData(customer).balancePaisa, 50000);
    assert.equal(accountData(customer).ledger.length, 1);
    assert.equal(Object.getPrototypeOf(accountData(customer).ledger[0]), Object.prototype);
    assert.equal(Object.getPrototypeOf(adminData(owner.id).payments[0]), Object.prototype);
    assert.equal(adminData(owner.id).audit.length, 1);
    assert.throws(() => reviewPayment({ ...review, decision: "reject" }, owner.id), /already reviewed/);
  });

  let walletOrderId = "";
  await t.test("wallet checkout calculates server price and retry never charges twice", () => {
    const input = order();
    const first = createOrder(input, customer); walletOrderId = first.id;
    const retry = createOrder(input, customer);
    assert.equal(first.id, retry.id);
    assert.equal(first.amountPaisa, 18625);
    assert.equal(first.status, "awaiting_delivery");
    chooseDelivery({ orderId: first.id, deliveryWindowMinutes: 0 }, customer);
    assert.equal(Object.getPrototypeOf(accountData(customer).orders[0]), Object.prototype);
    assert.equal(accountData(customer).balancePaisa, 31375);
    assert.equal(accountData(customer).ledger.filter((entry) => entry.kind === "order").length, 1);
    assert.throws(() => createOrder({ ...input, quantity: 1000 }, customer), /different order/);
    assert.throws(() => createOrder({ ...order(), price: 1 }, customer));
    assert.throws(() => createOrder({ ...order(), quantity: 1 }, customer), /outside/);
    assert.throws(() => createOrder({ ...order(), quantity: 1.5 }, customer));
    assert.throws(() => createOrder(order(), null), /sign in/);
    assert.equal(accountData(outsider).orders.length, 0);
  });

  await t.test("concurrent/repeated wallet attempts cannot overspend", async () => {
    const results = await Promise.allSettled([Promise.resolve().then(() => createOrder(order(), customer)), Promise.resolve().then(() => createOrder(order(), customer))]);
    assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal(accountData(customer).balancePaisa, 12750);
  });

  let directId = "";
  await t.test("direct payment bypasses the wallet and cannot complete before verification", () => {
    const input = { ...order(), method: "direct", reference: "ESEWA-DIRECT-001" };
    const direct = createOrder(input, customer); directId = direct.id;
    assert.equal(direct.status, "awaiting_payment");
    assert.equal(accountData(customer).balancePaisa, 12750);
    assert.throws(() => updateOrderStatus({ orderId: direct.id, status: "completed", note: "Done" }, owner.id), /Only paid/);
    assert.equal(createOrder(input, customer).id, direct.id);
    const claim = accountData(customer).payments.find((entry) => entry.orderId === direct.id)!;
    reviewPayment({ paymentId: claim.id, decision: "approve", confirmedReceived: true, note: "Verified direct payment" }, owner.id);
    assert.equal(accountData(customer).orders.find((entry) => entry.id === direct.id)!.status, "awaiting_delivery");
    assert.equal(accountData(customer).balancePaisa, 12750);
  });

  await t.test("guest payment, reference reuse, rejected deposits and bundles", () => {
    const guest = createOrder({ ...order(), method: "direct", email: "guest@example.test", reference: "GUEST-REF-001" }, null);
    assert.equal(guest.status, "awaiting_payment");
    assert.throws(() => requestTopup({ amount: 100, reference: "GUEST-REF-001", requestKey: randomUUID() }, customer), /already been submitted/);
    const rejected = requestTopup({ amount: 100, reference: "REJECT-REF-001", requestKey: randomUUID() }, customer);
    reviewPayment({ paymentId: rejected.id, decision: "reject", confirmedReceived: false, note: "Payment not received" }, owner.id);
    assert.equal(accountData(customer).balancePaisa, 12750);
    assert.throws(() => requestTopup({ amount: 100.001, reference: "DECIMAL-TEST", requestKey: randomUUID() }, customer), /decimal/);
    assert.throws(() => createOrder({ itemId: "COMBO_CREATOR_STARTER", quantity: 1, links: link, method: "direct", email: "guest@example.test", reference: "BUNDLE-REF-1", requestKey: randomUUID() }, null), /each platform/);
    const bundle = createOrder({ itemId: "COMBO_CREATOR_STARTER", quantity: 1, links: [...link, { platform: "Instagram", url: "https://instagram.com/test" }], method: "direct", email: "guest@example.test", reference: "BUNDLE-REF-1", requestKey: randomUUID() }, null);
    assert.equal(bundle.amountPaisa, 99900);
    assert.throws(() => createOrder({ ...order(), method: "direct", reference: "INVALID-LINK-1", links: [{ platform: "Facebook", url: "javascript:alert(1)" }] }, customer));
  });

  await t.test("provider minimums are enforced on direct and wallet orders", () => {
    const flexible = { ...order(), itemId: "FB_05", quantity: 10, method: "direct", reference: "MIN-TEN-VALID" };
    const accepted = createOrder(flexible, customer);
    assert.equal(accepted.amountPaisa, 89, "10 units are priced proportionally at the unchanged storefront rate");
    assert.equal(accountData(customer).balancePaisa, 12750, "Direct minimum-size order does not debit wallet");
    assert.throws(() => createOrder({ ...flexible, quantity: 9, requestKey: randomUUID(), reference: "MIN-TEN-LOW" }, customer), /outside/);
    assert.throws(() => createOrder({ ...flexible, quantity: 50001, requestKey: randomUUID(), reference: "MIN-TEN-HIGH" }, customer), /outside/);
    assert.throws(() => createOrder({ ...order(), quantity: 10 }, customer), /outside/, "Facebook page likes + followers requires at least 100");
    const deposit = requestTopup({ amount: 100, reference: "MIN-TEN-WALLET", requestKey: randomUUID() }, outsider);
    reviewPayment({ paymentId: deposit.id, decision: "approve", confirmedReceived: true, note: "Isolated test deposit" }, owner.id);
    const paid = createOrder({ ...order(), itemId: "FB_05", quantity: 10 }, outsider);
    assert.equal(paid.amountPaisa, 89);
    assert.equal(accountData(outsider).balancePaisa, 9911, "Wallet deducts the exact 10-unit price");
    assert.throws(() => createOrder({ ...order(), itemId: "SUV_1901" }, customer), /does not exist/, "Private provider tests are not orderable");
    assert.throws(() => createOrder({ ...order(), itemId: "SUV_1731" }, customer), /does not exist/, "The storefront keeps its existing service IDs");
  });

  await t.test("paid customers choose timing after approval without a second charge", () => {
    const input = { ...order(), itemId: "FB_03", quantity: 100, method: "direct", reference: "TIMED-DIRECT-001" };
    const direct = createOrder(input, customer);
    const choice = { orderId: direct.id, deliveryWindowMinutes: 60 };
    assert.throws(() => chooseDelivery(choice, customer), /approved/, "Pending payments cannot choose timing");
    assert.throws(() => chooseDelivery(choice, outsider), /not found/, "Only the owner may configure delivery");
    const payment = accountData(customer).payments.find((entry) => entry.orderId === direct.id)!;
    reviewPayment({ paymentId: payment.id, decision: "approve", confirmedReceived: true, note: "Simulated payment approved" }, owner.id);
    assert.equal(accountData(customer).orders.find((entry) => entry.id === direct.id)!.status, "awaiting_delivery");
    assert.throws(() => updateOrderStatus({ orderId: direct.id, status: "processing", note: "Start" }, owner.id), /Only paid/, "Admin cannot dispatch before the customer's choice");
    const before = accountData(customer);
    assert.equal(chooseDelivery(choice, customer).status, "queued");
    const saved = accountData(customer).orders.find((entry) => entry.id === direct.id)!;
    assert.equal(saved.deliveryWindowMinutes, 60);
    assert.deepEqual(JSON.parse(saved.deliveryPlan!), { version: 1, durationMinutes: 60, providerServiceId: 1768, totalQuantity: 100, runs: 5, quantityPerRun: 20, intervalMinutes: 15 });
    assert.equal(chooseDelivery(choice, customer).id, direct.id, "Retry is idempotent");
    assert.equal(accountData(customer).balancePaisa, before.balancePaisa);
    assert.equal(accountData(customer).ledger.length, before.ledger.length);
    assert.throws(() => chooseDelivery({ ...choice, deliveryWindowMinutes: 120 }, customer), /already confirmed/);
    assert.throws(() => updateOrderStatus({ orderId: direct.id, status: "processing", note: "Start" }, owner.id), /Confirm/, "Admin must confirm the provider schedule");
    updateOrderStatus({ orderId: direct.id, status: "processing", note: "Mock provider schedule configured", scheduleConfirmed: true }, owner.id);

    const funded = createOrder({ ...order(), itemId: "FB_03", quantity: 100 }, outsider);
    assert.equal(funded.status, "awaiting_delivery");
    const paidBalance = accountData(outsider).balancePaisa;
    chooseDelivery({ orderId: funded.id, deliveryWindowMinutes: 60 }, outsider);
    assert.equal(accountData(outsider).balancePaisa, paidBalance, "Wallet payment happens once, before selecting timing");

    const tooSmall = createOrder({ ...order(), quantity: 100 }, outsider);
    assert.throws(() => chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 60 }, outsider), /at least 200/);
    assert.equal(chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 0 }, outsider).status, "queued");
    assert.throws(() => chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 30 }, outsider));
    assert.throws(() => chooseDelivery({ orderId: tooSmall.id, deliveryWindowMinutes: 0, runs: 100 }, outsider), /Unrecognized/);
    const guest = createOrder({ ...input, email: "guest-timing@example.test", reference: "TIMED-GUEST-001", requestKey: randomUUID() }, null);
    const guestPayment = adminData(owner.id).payments.find((entry) => entry.orderId === guest.id)!;
    reviewPayment({ paymentId: guestPayment.id, decision: "approve", confirmedReceived: true, note: "Simulated guest payment" }, owner.id);
    assert.equal(adminData(owner.id).orders.find((entry) => entry.id === guest.id)!.status, "queued", "Guest retains original default delivery");
  });

  await t.test("admin status changes are audited; passwords and redirects are safe", async () => {
    updateOrderStatus({ orderId: walletOrderId, status: "processing", note: "Provider order 123" }, owner.id);
    updateOrderStatus({ orderId: walletOrderId, status: "completed", note: "Provider confirmed complete" }, owner.id);
    assert.throws(() => updateOrderStatus({ orderId: walletOrderId, status: "processing", note: "Invalid restart" }, owner.id), /Only paid/);
    const stored = db.prepare("SELECT password FROM account WHERE userId = ? AND providerId = 'credential'").get(customer.id) as { password: string };
    assert.notEqual(stored.password, "Long-Test-Passphrase-2026");
    assert.ok(stored.password.length > 32);
    assert.equal(safeNext("//evil.test"), "/account");
    assert.equal(safeNext("/\\evil.test"), "/account");
    assert.equal(safeNext("/?resumeOrder=1#calculator"), "/?resumeOrder=1#calculator");
    await assert.rejects(auth.api.signInEmail({ body: { email: customer.email, password: "wrong-password" } }));
    assert.ok(await auth.api.signInEmail({ body: { email: customer.email, password: "Long-Test-Passphrase-2026" } }));
  });
});

after(async () => {
  const { getDb } = await import("../lib/server/db");
  getDb().close();
  rmSync(directory, { recursive: true, force: true });
});
