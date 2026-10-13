import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MASTER_SERVICE_CATALOG } from "../config/catalogData";
import snapshot from "../data/suvakrio-services.json";
import mappings from "../config/serviceQuantityMappings.json";
import { buildConfiguredCatalog } from "../lib/providerCatalog";
import { planDelivery, providerDripSettings, readDeliveryPlan } from "../lib/delivery";

const services = buildConfiguredCatalog(MASTER_SERVICE_CATALOG, snapshot, mappings);
const follower = services.find((service) => service.id === "FB_03")!;

test("100 followers over one hour is an exact total of five valid batches", () => {
  const plan = planDelivery(follower, 100, 60)!;
  assert.equal(plan.runs, 5);
  assert.equal(plan.quantityPerRun, 20);
  assert.equal(plan.intervalMinutes, 15);
  assert.equal((plan.runs - 1) * plan.intervalMinutes, 60);
  assert.deepEqual(providerDripSettings(plan), { service: 1768, quantity: 20, runs: 5, interval: 15 });
  assert.equal(plan.runs * providerDripSettings(plan).quantity, 100, "Provider receives quantity per run, preventing multiplied charges");
  assert.deepEqual(readDeliveryPlan(JSON.stringify(plan)), plan);
  assert.equal(readDeliveryPlan("invalid"), null);
  assert.equal(readDeliveryPlan(JSON.stringify({ ...plan, quantityPerRun: 100 })), null);
  assert.equal(planDelivery(follower, 100, 0), null);
});

test("service minimums, totals, intervals and unsupported services are enforced", () => {
  assert.throws(() => planDelivery(services.find((service) => service.id === "FB_01")!, 100, 60), /at least 200/);
  assert.throws(() => planDelivery(follower, 101, 60), /cannot be evenly split/);
  assert.throws(() => planDelivery(follower, 100, 30), /1 hour to 7 days/);
  assert.throws(() => planDelivery(follower, 100, 10081), /1 hour to 7 days/);
  assert.throws(() => planDelivery(services.find((service) => service.id === "FB_05")!, 100, 60), /not available/);
  assert.throws(() => planDelivery(services.find((service) => service.id === "YT_01")!, 1000, 60), /not available/);
  for (const quantity of [100, 120, 200, 500, 1000, 10000]) for (const minutes of [60, 180, 360, 1440, 10080]) {
    const plan = planDelivery(follower, quantity, minutes)!;
    assert.equal(plan.runs * plan.quantityPerRun, quantity);
    assert.ok(plan.quantityPerRun >= follower.min!);
    assert.equal((plan.runs - 1) * plan.intervalMinutes, minutes);
  }
});

test("existing orders gain delivery defaults without changing balances or statuses", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dmnp-delivery-migration-"));
  process.env.DATABASE_PATH = join(directory, "legacy.sqlite");
  const legacy = new DatabaseSync(process.env.DATABASE_PATH);
  legacy.exec("CREATE TABLE appOrder (id TEXT PRIMARY KEY, userId TEXT, email TEXT, itemId TEXT, itemKind TEXT, itemName TEXT, quantity INTEGER, amountPaisa INTEGER, links TEXT, method TEXT, status TEXT, requestScope TEXT, requestKey TEXT, createdAt TEXT, updatedAt TEXT)");
  legacy.exec("INSERT INTO appOrder VALUES ('legacy', NULL, 'legacy@example.test', 'FB_03', 'service', 'Existing order', 100, 1390, '[]', 'direct', 'processing', 'legacy', 'legacy', '2026-10-01', '2026-10-01')");
  legacy.close();
  const { getDb } = await import("../lib/server/db");
  const db = getDb();
  try {
    const order = db.prepare("SELECT * FROM appOrder WHERE id = 'legacy'").get()!;
    assert.equal(order.status, "processing");
    assert.equal(order.amountPaisa, 1390);
    assert.equal(order.deliveryWindowMinutes, 0);
    assert.equal(order.deliveryPlan, null);
    assert.equal(getDb(), db, "Cached connection also works after migration");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
