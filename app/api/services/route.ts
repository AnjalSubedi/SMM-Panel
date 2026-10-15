import { NextResponse } from "next/server";
import { platformOrder, packages, type ServiceCatalogResponse } from "../../../lib/catalog";
import { configuredMarkup } from "../../../lib/fulfillmentCatalog";
import { services, servicesVerifiedAt } from "../../../lib/services";
import { automationEnabled, liveRetailCatalog } from "../../../lib/server/suvakrio";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  let catalog = { services, packages: [...packages] }; let source: ServiceCatalogResponse["source"] = "configured";
  if (automationEnabled()) {
    try { const live = await liveRetailCatalog(); catalog = { services: live.services, packages: [...live.packages] }; source = "live"; }
    catch { catalog = { services: services.map(s => ({ ...s, automaticDeliveryAvailable: false })), packages: packages.map(s => ({ ...s, automaticDeliveryAvailable: false })) }; source = "snapshot"; }
  }
  const available = new Set(catalog.services.map(s => s.platform));
  return NextResponse.json({ ...catalog, platforms: platformOrder.filter(p => available.has(p)), markupPercent: automationEnabled() ? configuredMarkup() : 0, source, updatedAt: source === "live" ? new Date().toISOString() : servicesVerifiedAt }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
