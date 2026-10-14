import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/postgres";
import { TERMS_VERSION, termsAcceptance, termsCopy } from "../lib/terms";

test("explicit bilingual acceptance is required and stored atomically with every new payment flow", async () => {
  const database = await testDatabase();
  try {
    const { getAuth } = await import("../lib/server/auth");
    const { getDb } = await import("../lib/server/db");
    const { createOrder, requestTopup } = await import("../lib/server/commerce");
    const auth = await getAuth();
    const signedUp = await auth.api.signUpEmail({ body: { name: "Terms Customer", email: "terms@example.test", password: "Isolated-Terms-Password-2026!" } });
    const user = { id: signedUp.user.id, name: "Terms Customer", email: "terms@example.test", emailVerified: false, isAdmin: false };
    const db = getDb();
    const base = { itemId: "FB_05", quantity: 10, links: [{ platform: "Facebook", url: "https://www.facebook.com/terms-test" }], method: "direct", email: "guest-terms@example.test", reference: "TERMS-DIRECT-001", requestKey: randomUUID() };
    const deposit = { amount: 100, reference: "TERMS-TOPUP-001", requestKey: randomUUID() };
    const balances = () => db.query('SELECT * FROM "appWallet"');
    for (const method of ["direct", "wallet"] as const) {
      for (const invalid of [{}, { ...termsAcceptance(), termsAccepted: false }, { ...termsAcceptance(), termsVersion: "old" }, { ...termsAcceptance(), termsLanguage: "other" }]) {
        await assert.rejects(createOrder({ ...base, method, ...invalid }, method === "direct" ? null : user));
      }
    }
    for (const invalid of [{}, { ...termsAcceptance(), termsAccepted: false }, { ...termsAcceptance(), termsVersion: "old" }]) await assert.rejects(requestTopup({ ...deposit, ...invalid }, user));
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM "appOrder"')).rows[0].count, 0);
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM "appPayment"')).rows[0].count, 0);
    assert.equal((await balances()).rowCount, 0, "Invalid consent creates no wallet or debit");
    const input = { ...base, ...termsAcceptance("ne") };
    const before = Date.now();
    const direct = await createOrder(input, null);
    const evidence = (await db.query('SELECT * FROM "appTermsAcceptance" WHERE "orderId"=$1', [direct.id])).rows[0];
    assert.equal(evidence.purpose, "order"); assert.equal(evidence.language, "ne"); assert.equal(evidence.version, TERMS_VERSION);
    assert.ok(Date.parse(evidence.acceptedAt) >= before);
    assert.deepEqual(JSON.parse(evidence.content).sections, termsCopy.ne.order);
    assert.equal((await createOrder(input, null)).id, direct.id);
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM "appTermsAcceptance"')).rows[0].count, 1, "Retry does not replace or duplicate consent");
    const topup = await requestTopup({ ...deposit, ...termsAcceptance() }, user);
    assert.equal((await requestTopup({ ...deposit, ...termsAcceptance() }, user)).id, topup.id);
    const walletEvidence = (await db.query('SELECT * FROM "appTermsAcceptance" WHERE "paymentId"=$1', [topup.id])).rows[0];
    assert.equal(walletEvidence.purpose, "wallet"); assert.equal(walletEvidence.language, "en");
    assert.deepEqual(JSON.parse(walletEvidence.content).sections, termsCopy.en.wallet);
    await assert.rejects(createOrder({ ...base, reference: undefined, method: "wallet", requestKey: randomUUID(), ...termsAcceptance() }, user), /Insufficient/);
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM "appTermsAcceptance"')).rows[0].count, 2, "Failed wallet debit rolls back consent too");
    await db.query('UPDATE "appWallet" SET "balancePaisa"=10000 WHERE "userId"=$1', [user.id]);
    const paid = await createOrder({ ...base, reference: undefined, method: "wallet", requestKey: randomUUID(), ...termsAcceptance() }, user);
    assert.ok((await db.query('SELECT id FROM "appTermsAcceptance" WHERE "orderId"=$1', [paid.id])).rowCount);
    assert.equal((await db.query('SELECT "balancePaisa" FROM "appWallet" WHERE "userId"=$1', [user.id])).rows[0].balancePaisa, 9911);
    await assert.rejects(createOrder({ ...base, reference: "TERMS-FORGED-TIME", requestKey: randomUUID(), ...termsAcceptance(), termsAcceptedAt: "2000-01-01" }, null));
    assert.equal(termsCopy.en.order.length, termsCopy.ne.order.length);
    assert.equal(termsCopy.en.wallet.length, termsCopy.ne.wallet.length);
  } finally { await database.close(); }
});
