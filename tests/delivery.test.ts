import { test } from "node:test";
import assert from "node:assert/strict";
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
