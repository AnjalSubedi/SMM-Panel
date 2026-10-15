import type { CatalogItem } from "./catalog";
import { getServiceCategory } from "./serviceCategories";

export type DeliveryPlan = { version: 1; durationMinutes: number; providerServiceId: number; totalQuantity: number; runs: number; quantityPerRun: number; intervalMinutes: number };

export function supportsGradualDelivery(service: CatalogItem): boolean {
  return service.gradualDeliveryAvailable !== false && service.kind === "service" && service.quantityLimitsVerified === true && Boolean(service.providerServiceId) &&
    service.quantityPerProviderUnit === 1 && (service.min ?? 1) < (service.max ?? 1) &&
    getServiceCategory(service) === "Followers & subscribers";
}

export function deliveryLabel(minutes: number): string {
  if (minutes === 0) return "Default delivery";
  if (minutes % 1440 === 0) return "Spread over " + minutes / 1440 + (minutes === 1440 ? " day" : " days");
  if (minutes % 60 === 0) return "Spread over " + minutes / 60 + (minutes === 60 ? " hour" : " hours");
  return "Spread over " + minutes + " minutes";
}

export function planDelivery(service: CatalogItem, quantity: number, durationMinutes: number): DeliveryPlan | null {
  if (durationMinutes === 0) return null;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 60 || durationMinutes > 10080) throw new Error("Choose a timeframe from 1 hour to 7 days.");
  if (!supportsGradualDelivery(service)) throw new Error("Gradual delivery is not available for this service. Use default delivery.");
  const min = service.min ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity < min || quantity > (service.max ?? min)) throw new Error("The quantity is outside this service's limits.");
  if (quantity < min * 2) throw new Error("This service needs at least " + (min * 2).toLocaleString("en-US") + " units to split delivery into valid batches. Use default delivery for this order.");
  // Equal, whole-number batches; each meets the minimum. First dispatch is at
  // start, last dispatch at the requested window. Never multiply the total.
  for (let runs = Math.min(61, Math.floor(quantity / min), durationMinutes + 1); runs >= 2; runs--) {
    if (quantity % runs !== 0 || durationMinutes % (runs - 1) !== 0) continue;
    return { version: 1, durationMinutes, providerServiceId: service.providerServiceId!, totalQuantity: quantity, runs, quantityPerRun: quantity / runs, intervalMinutes: durationMinutes / (runs - 1) };
  }
  throw new Error("This quantity cannot be evenly split over that timeframe within the service minimum. Choose default delivery or contact support.");
}

export function readDeliveryPlan(value: string | null | undefined): DeliveryPlan | null {
  try { const plan = JSON.parse(value || "null"); return plan?.version === 1 && Number.isInteger(plan.runs) && plan.runs >= 2 && Number.isInteger(plan.quantityPerRun) && plan.quantityPerRun > 0 && Number.isInteger(plan.intervalMinutes) && plan.intervalMinutes > 0 && plan.runs * plan.quantityPerRun === plan.totalQuantity && (plan.runs - 1) * plan.intervalMinutes === plan.durationMinutes ? plan : null; } catch { return null; }
}

// Suvakrio quantity is PER RUN when runs is supplied, not the order total.
// This builds settings only; it performs no requests and contains no API key.
export function providerDripSettings(plan: DeliveryPlan) {
  return { service: plan.providerServiceId, quantity: plan.quantityPerRun, runs: plan.runs, interval: plan.intervalMinutes };
}
