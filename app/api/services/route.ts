import { NextResponse } from "next/server";
import { platformOrder, type ServiceCatalogResponse } from "../../../lib/catalog";
import { services, servicesVerifiedAt } from "../../../lib/services";

export async function GET() {
  const available = new Set(services.map((service) => service.platform));
  const response: ServiceCatalogResponse = {
    services,
    platforms: platformOrder.filter((platform) => available.has(platform)),
    markupPercent: 0,
    source: "configured",
    updatedAt: servicesVerifiedAt,
  };
  return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
