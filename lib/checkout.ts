import type { CatalogItem } from "./catalog";
import { MASTER_SERVICE_CATALOG } from "../config/catalogData";

export const checkoutPaths = { services: "/services?resumeOrder=1#calculator", account: "/account?resumeOrder=1#new-order" } as const;

export function checkoutReturnPath(value: unknown): string {
  return value === checkoutPaths.account ? checkoutPaths.account : checkoutPaths.services;
}

export function requiredPlatforms(item: CatalogItem): string[] {
  if (item.kind === "service") return [item.platform || "Web & Discord"];
  return [...new Set((item.apiSteps || []).map((step) => MASTER_SERVICE_CATALOG.find((service) => service.suvakrioServiceId === step.serviceId)?.platform).filter((value): value is string => Boolean(value)))];
}
