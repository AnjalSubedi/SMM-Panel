import { MASTER_SERVICE_CATALOG, COMBO_PACKAGES } from "../config/catalogData";
import { buildConfiguredCatalog } from "./providerCatalog";
import mappings from "../config/serviceQuantityMappings.json";
import snapshot from "../data/suvakrio-services.json";
import { bundleCopy, customerItemName } from "./customerCopy";
import type { CatalogItem } from "./catalog";
import type { DeliveryPlan } from "./delivery";

export type ProviderService = { service: number; name: string; type: string; category: string; rate: number; min: number; max: number; dripfeed?: boolean };
export type DeliveryTarget = { key: string; platform: string; label: string; help?: string };
export type FulfillmentStep = { serviceId: number; name: string; platform: string; quantity: number; runs: number; interval: number; link: string; costPaisa: number; billingDivisor: 1000 };
const master = MASTER_SERVICE_CATALOG;
export const savedProviderCatalog: ProviderService[] = snapshot;
export function configuredMarkup(): number {
  const value = Number(process.env.SERVICE_MARKUP_PERCENT ?? 75);
  return Number.isFinite(value) && value >= 0 && value <= 1000 ? value : 75;
}
function usable(provider: ProviderService | undefined) {
  // These products need inputs our checkout does not collect. Never guess them.
  return provider && /^default$/i.test(provider.type) && !/custom|comments|reviews|subscription|poll|battle/i.test(provider.name) && provider.rate > 0;
}
function mapping(id: string) { return (mappings as Record<string, { providerServiceId: number; quantityPerProviderUnit?: number }>)[id]; }
export function providerCostPaisa(id: string, quantity: number, provider: ProviderService) {
  const multiplier = mapping(id)?.quantityPerProviderUnit ?? 1;
  // The provider publishes rates per 1,000 API units, including mapped fixed packs.
  const units = quantity / multiplier;
  return Math.ceil(provider.rate * 100 * units / 1000);
}
function targetKind(id: string) {
  if (/^(FB_01|FB_02|FB_03|IG_01|IG_02|IG_03|YT_01|TT_01|TG_01|TW_01|LI_01|LI_02|SP_02)$/.test(id)) return "profile";
  return "content";
}
export function deliveryTargets(item: CatalogItem): DeliveryTarget[] {
  if (item.kind === "service") return [{ key: item.platform!, platform: item.platform!, label: item.platform + " profile, page or video link", ...(item.id === "FB_08" ? { help: "This watch-time service requires a public 3-hour Facebook video. Check the video duration before paying." } : {}) }];
  const targets = new Map<string, DeliveryTarget>();
  for (const step of item.apiSteps ?? []) {
    const service = master.find(s => s.suvakrioServiceId === step.serviceId);
    if (!service) continue;
    const key = service.platform + ":" + targetKind(service.id);
    targets.set(key, { key, platform: service.platform, label: service.platform + (targetKind(service.id) === "profile" ? " profile, page or channel link" : " post, reel or video link"), ...(service.id === "FB_08" ? { help: "This watch-time service requires a public 3-hour Facebook video. Check the video duration before paying." } : {}) });
  }
  return [...targets.values()];
}
export function automaticRetailCatalog(providers: readonly ProviderService[], markup = configuredMarkup(), balancePaisa = Number.POSITIVE_INFINITY) {
  const services = buildConfiguredCatalog(master, providers, mappings).map(item => {
    const configured = master.find(s => s.id === item.id)!;
    const provider = providers.find(p => p.service === item.providerServiceId);
    const available = Boolean(item.quantityLimitsVerified && usable(provider));
    const cost = provider ? providerCostPaisa(item.id, configured.unitSize, provider) : 0;
    return { ...item, name: customerItemName(item.id, item.name), price: available ? Math.ceil(cost * (1 + markup / 100)) / 100 : item.price, automaticDeliveryAvailable: available, gradualDeliveryAvailable: available && provider?.dripfeed !== false };
  });
  const packages: CatalogItem[] = COMBO_PACKAGES.map((bundle, index) => {
    let cost = 0; let available = true;
    for (const step of bundle.apiSteps) {
      const configured = master.find(s => s.suvakrioServiceId === step.serviceId);
      const item = services.find(s => s.id === configured?.id);
      const provider = providers.find(p => p.service === item?.providerServiceId);
      const multiplier = item?.quantityPerProviderUnit ?? 1;
      if (!configured || !item?.automaticDeliveryAvailable || !provider || step.quantity / multiplier < provider.min || step.quantity / multiplier > provider.max || step.quantity % multiplier !== 0) { available = false; continue; }
      cost += providerCostPaisa(configured.id, step.quantity, provider);
    }
    return { id: bundle.id, kind: "package", packageCode: String.fromCharCode(65 + index), name: bundleCopy[bundle.id]?.name ?? bundle.name, badge: bundleCopy[bundle.id]?.badge ?? bundle.badge, target: bundleCopy[bundle.id]?.target ?? bundle.target, inclusions: bundleCopy[bundle.id]?.inclusions ?? bundle.features, apiSteps: bundle.apiSteps, price: available ? Math.ceil(cost * (1 + markup / 100)) / 100 : bundle.priceNpr, automaticDeliveryAvailable: available && cost <= balancePaisa };
  });
  return { services, packages };
}
export function fulfillmentSteps(item: CatalogItem, quantity: number, links: { platform: string; url: string; target?: string }[], providers: readonly ProviderService[], plan: DeliveryPlan | null): FulfillmentStep[] {
  const configuredSteps = item.kind === "service" ? [{ id: item.id, quantity }] : (item.apiSteps ?? []).map(step => ({ id: master.find(s => s.suvakrioServiceId === step.serviceId)?.id ?? "", quantity: step.quantity }));
  if (!configuredSteps.length) throw new Error("This service is not available for automatic delivery.");
  return configuredSteps.map(step => {
    const configured = master.find(s => s.id === step.id);
    const mapped = mapping(step.id);
    const provider = providers.find(p => p.service === mapped?.providerServiceId);
    if (!configured || !mapped || !usable(provider)) throw new Error("This service is not available for automatic delivery.");
    const multiplier = mapped.quantityPerProviderUnit ?? 1;
    const total = step.quantity / multiplier;
    if (!Number.isSafeInteger(total) || total < provider!.min || total > provider!.max) throw new Error("The provider cannot deliver this quantity. Refresh the catalog before ordering.");
    const key = item.kind === "service" ? configured.platform : configured.platform + ":" + targetKind(step.id);
    const link = links.find(l => (l.target ?? l.platform) === key)?.url;
    if (!link) throw new Error("Provide a separate profile and content link where this package requires both.");
    if (plan && (item.kind !== "service" || multiplier !== 1 || provider!.dripfeed === false || plan.providerServiceId !== provider!.service || plan.totalQuantity !== quantity || plan.quantityPerRun < provider!.min || plan.runs * plan.quantityPerRun !== quantity)) throw new Error("Timed delivery is unavailable for this provider service. Choose default delivery.");
    return { serviceId: provider!.service, name: customerItemName(configured.id, configured.name), platform: configured.platform, quantity: plan ? plan.quantityPerRun : total, runs: plan?.runs ?? 1, interval: plan?.intervalMinutes ?? 0, link, costPaisa: providerCostPaisa(step.id, step.quantity, provider!), billingDivisor: 1000 };
  });
}
