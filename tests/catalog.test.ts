import { test } from "node:test";
import assert from "node:assert/strict";
import snapshot from "../data/suvakrio-services.json";
import mappings from "../config/serviceQuantityMappings.json";
import { MASTER_SERVICE_CATALOG } from "../config/catalogData";
import { buildConfiguredCatalog } from "../lib/providerCatalog";
import { calculateTotal, normalizeQuantity, prepareServiceOrder } from "../lib/order";
import { getServiceCategory } from "../lib/serviceCategories";

const catalog = buildConfiguredCatalog(MASTER_SERVICE_CATALOG, snapshot, mappings);

test("the 58 curated services and prices stay intact while provider equivalents supply limits", () => {
  assert.equal(catalog.length, 58);
  assert.equal(catalog.filter((item) => item.quantityLimitsVerified).length, 41);
  for (const item of catalog) {
    const original = MASTER_SERVICE_CATALOG.find((service) => service.id === item.id)!;
    assert.equal(item.name, original.name);
    assert.equal(item.price, original.rateNpr);
    assert.equal(item.unitSize, original.unitSize);
    assert.notEqual(getServiceCategory(item), "Other services");
    if (item.quantityLimitsVerified) {
      const provider = snapshot.find((service) => service.service === item.providerServiceId)!;
      assert.ok(provider);
      const ratio = item.quantityPerProviderUnit!;
      assert.ok(item.min! >= provider.min * ratio);
      assert.ok(item.max! <= provider.max * ratio);
    } else {
      assert.equal(item.min, original.minQty);
      assert.equal(item.max, original.maxQty);
      assert.equal(item.providerServiceId, undefined, "Do not present placeholder IDs as verified provider IDs");
    }
  }
  assert.equal(catalog.find((item) => item.id === "FB_01")!.min, 100);
  assert.equal(catalog.find((item) => item.id === "FB_05")!.min, 10);
  assert.equal(catalog.find((item) => item.id === "FB_10")!.min, 30);
  assert.equal(catalog.find((item) => item.id === "YT_04")!.min, 1000);
  assert.equal(catalog.find((item) => item.id === "TW_03")!.max, 1000, "Provider maximum takes precedence over an excessive retail cap");
  assert.equal(catalog.find((item) => item.id === "FB_08")!.min, 60000, "A provider package of one means 60,000 storefront minutes");
  assert.equal(catalog.find((item) => item.id === "YT_06")!.min, 4000, "Full watch-time package stays fixed");
  assert.equal(catalog.find((item) => item.id === "IG_05")!.min, 1, "Unmatched fixed subscription stays fixed");
});

test("small quantities use individual units and the same paisa rounding as checkout", () => {
  const flexible = catalog.find((item) => item.id === "FB_05")!;
  assert.equal(normalizeQuantity(flexible, 11), 11);
  assert.equal(normalizeQuantity(flexible, 9), 10);
  assert.equal(calculateTotal(flexible, 10), 0.89);
  assert.equal(prepareServiceOrder(flexible, 11).quantity, "11");
  assert.equal(calculateTotal(catalog.find((item) => item.id === "FB_01")!, 100), 14.9);
  assert.equal(calculateTotal({ ...flexible, price: 0.29 }, 500), 0.15, "Half-paisa totals round consistently");
});

test("invalid, private or incompatible mappings retain configured quantity limits", () => {
  const original = MASTER_SERVICE_CATALOG[0];
  for (const mapping of [{ providerServiceId: 999999 }, { providerServiceId: 1900 }, { providerServiceId: 1705 }, { providerServiceId: 1741 }]) {
    const item = buildConfiguredCatalog([original], snapshot, { [original.id]: mapping })[0];
    assert.equal(item.quantityLimitsVerified, false);
    assert.equal(item.min, original.minQty);
    assert.equal(item.max, original.maxQty);
  }
});
