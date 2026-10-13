import { formatPrice, formatQuantity } from "./catalogFormat";
import type { CatalogItem } from "./catalog";

export function normalizeQuantity(service: CatalogItem, value: number): number {
  const min = service.min ?? 1;
  const max = service.max ?? min;
  return Math.min(max, Math.max(min, Number.isFinite(value) ? Math.trunc(value) : min));
}

export function calculateTotal(service: CatalogItem, quantity: number): number {
  return Math.round(Math.round(service.price * 100) * normalizeQuantity(service, quantity) / (service.unitSize ?? 1)) / 100;
}

export function prepareServiceOrder(service: CatalogItem, value: number): CatalogItem {
  const quantity = normalizeQuantity(service, value);
  return {
    ...service,
    quantity: String(quantity),
    price: calculateTotal(service, quantity),
    unitLabel: `Total for ${formatQuantity(quantity)}`,
    inclusions: [
      `Quantity: ${formatQuantity(quantity)}`,
      `Rate: ${formatPrice(service.price)} / ${service.unitLabel}`,
      "Delivery to your public link. No password required.",
    ],
  };
}
