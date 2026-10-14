import type { CatalogItem } from "./catalog";

type ConfiguredService = { id: string; platform: string; name: string; rateNpr: number; unitSize: number; unitLabel: string; minQty: number; maxQty: number };
type ProviderService = { service: number; name: string; category: string; min: number; max: number };
type QuantityMapping = { providerServiceId: number; quantityPerProviderUnit?: number; preserveFixedQuantity?: boolean };

// Normalize explicit provider equivalents for public quantity limits.
// Automatic fulfillment applies additional type, input and cost validation.
// Preserve storefront names, prices, retail caps and fixed-size products.
export function buildConfiguredCatalog(configured: readonly ConfiguredService[], snapshot: readonly ProviderService[], mappings: Record<string, QuantityMapping>): CatalogItem[] {
  return configured.map((service) => {
    const mapping = mappings[service.id];
    const provider = mapping && snapshot.find((entry) => entry.service === mapping.providerServiceId);
    const multiplier = mapping?.quantityPerProviderUnit ?? 1;
    let min = service.minQty;
    let max = service.maxQty;
    let verified = false;
    if (provider && /[a-zA-Z]/.test(provider.name) && !/private testing|not for use/i.test(provider.category) &&
        Number.isSafeInteger(provider.min) && Number.isSafeInteger(provider.max) && provider.min > 0 && provider.max >= provider.min &&
        Number.isSafeInteger(multiplier) && multiplier > 0) {
      const providerMin = provider.min * multiplier;
      const providerMax = provider.max * multiplier;
      if (mapping.preserveFixedQuantity && service.minQty === service.maxQty) {
        verified = min >= providerMin && max <= providerMax && min % multiplier === 0;
      } else if (multiplier === 1 && Math.max(10, providerMin) <= Math.min(service.maxQty, providerMax)) {
        min = Math.max(10, providerMin);
        max = Math.min(service.maxQty, providerMax);
        verified = true;
      }
    }
    return {
      id: service.id,
      kind: "service",
      providerServiceId: verified ? provider!.service : undefined,
      quantityLimitsVerified: verified,
      quantityPerProviderUnit: verified ? multiplier : undefined,
      platform: service.platform,
      category: service.platform + " Services",
      name: service.name,
      price: service.rateNpr,
      unitSize: service.unitSize,
      unitLabel: service.unitLabel,
      min,
      max,
      inclusions: [service.unitLabel, "Quantity: " + min.toLocaleString("en-US") + "–" + max.toLocaleString("en-US")],
    };
  });
}
