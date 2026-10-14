import { formatPrice, formatQuantity } from "./catalogFormat";
import { COMBO_PACKAGES } from "../config/catalogData";
import { automaticRetailCatalog, savedProviderCatalog } from "./fulfillmentCatalog";
import { bundleCopy } from "./customerCopy";

export type CatalogItem = {
  id: string;
  kind: "service" | "package";
  platform?: string;
  category?: string;
  providerServiceId?: number;
  quantityLimitsVerified?: boolean;
  quantityPerProviderUnit?: number;
  automaticDeliveryAvailable?: boolean;
  name: string;
  price: number;
  quantity?: string;
  unitSize?: number;
  unitLabel?: string;
  min?: number;
  max?: number;
  refill?: boolean;
  cancel?: boolean;
  packageCode?: string;
  badge?: string;
  target?: string;
  apiSteps?: readonly { serviceId: number; quantity: number }[];
  inclusions: readonly string[];
};

export type ServiceCatalogResponse = {
  packages?: CatalogItem[];
  services: CatalogItem[];
  platforms: string[];
  markupPercent: number;
  source: "live" | "snapshot" | "configured";
  updatedAt: string;
};

export { platformOrder } from "./catalogFormat";

const originalPackages: readonly CatalogItem[] = COMBO_PACKAGES.map((bundle, index) => ({
  id: bundle.id,
  kind: "package" as const,
  packageCode: String.fromCharCode(65 + index),
  name: bundleCopy[bundle.id]?.name ?? bundle.name,
  price: bundle.priceNpr,
  badge: bundleCopy[bundle.id]?.badge ?? bundle.badge,
  target: bundleCopy[bundle.id]?.target ?? bundle.target,
  apiSteps: bundle.apiSteps,
  inclusions: bundleCopy[bundle.id]?.inclusions ?? bundle.features,
}));

export const packages: readonly CatalogItem[] = process.env.FULFILLMENT_MODE === "manual" ? originalPackages : automaticRetailCatalog(savedProviderCatalog).packages;

export function inferPlatform(category: string, name: string): string {
  const value = `${category} ${name}`.toLowerCase();
  const knownPlatforms: Array<[string, RegExp]> = [
    ["Facebook", /facebook/],
    ["Instagram", /instagram/],
    ["TikTok", /tiktok/],
    ["YouTube", /youtube/],
    ["Telegram", /telegram/],
    ["Twitter", /twitter|\bx\b/],
    ["Spotify", /spotify/],
    ["Discord", /discord/],
    ["Twitch", /twitch/],
  ];

  return knownPlatforms.find(([, pattern]) => pattern.test(value))?.[0] ?? "Other";
}

export function applyMarkup(rate: number, markupPercent: number): number {
  return Number((rate * (1 + markupPercent / 100)).toFixed(2));
}

export { formatPrice, formatQuantity } from "./catalogFormat";

export function buildOrderSummary(item: CatalogItem, settlement = "Direct eSewa"): string {
  const serviceDetails = item.kind === "service"
    ? [
        `Platform: ${item.platform}`,
        `Category: ${item.category}`,
        `Service ID: ${item.providerServiceId}`,
        ...(item.quantity ? [`Selected quantity: ${item.quantity}`] : []),
        `Allowed quantity: ${formatQuantity(item.min ?? 0)}-${formatQuantity(item.max ?? 0)}`,
        `${item.unitLabel ?? "Rate"}: ${formatPrice(item.price)}`,
      ]
    : [...item.inclusions.map((inclusion) => `- ${inclusion}`), `Total: ${formatPrice(item.price)}`];

  return [
    "Digital Marketing NP - Order Inquiry",
    item.kind === "package" ? `Package ${item.packageCode}: ${item.name}` : item.name,
    ...serviceDetails,
    `Payment method: ${settlement}`,
  ].join("\n");
}
