import { COMBO_PACKAGES } from "../config/catalogData";

export type CatalogItem = {
  id: string;
  kind: "service" | "package";
  platform?: string;
  category?: string;
  providerServiceId?: number;
  quantityLimitsVerified?: boolean;
  quantityPerProviderUnit?: number;
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
  services: CatalogItem[];
  platforms: string[];
  markupPercent: number;
  source: "live" | "snapshot" | "configured";
  updatedAt: string;
};

export const platformOrder = [
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "Telegram",
  "X (Twitter)",
  "LinkedIn",
  "Spotify",
  "Web & Discord",
] as const;

export const packages: readonly CatalogItem[] = COMBO_PACKAGES.map((bundle, index) => ({
  id: bundle.id,
  kind: "package" as const,
  packageCode: String.fromCharCode(65 + index),
  name: bundle.name,
  price: bundle.priceNpr,
  badge: bundle.badge,
  target: bundle.target,
  apiSteps: bundle.apiSteps,
  inclusions: bundle.features,
}));

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

export function formatPrice(price: number): string {
  return `NPR ${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("en-US");
}

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
    `Settlement: ${settlement}`,
  ].join("\n");
}
