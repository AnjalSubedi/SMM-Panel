import type { CatalogItem } from "./catalog";
import { MASTER_SERVICE_CATALOG } from "../config/catalogData";

export function requiredPlatforms(item: CatalogItem): string[] {
  if (item.kind === "service") return [item.platform || "Web & Discord"];
  return [...new Set((item.apiSteps || []).map((step) => MASTER_SERVICE_CATALOG.find((service) => service.suvakrioServiceId === step.serviceId)?.platform).filter((value): value is string => Boolean(value)))];
}
