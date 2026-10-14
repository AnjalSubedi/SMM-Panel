import { MASTER_SERVICE_CATALOG } from "../config/catalogData";
import snapshot from "../data/suvakrio-services.json";
import mappings from "../config/serviceQuantityMappings.json";
import metadata from "../data/suvakrio-services.meta.json";
import { buildConfiguredCatalog } from "./providerCatalog";
import { automaticRetailCatalog, savedProviderCatalog } from "./fulfillmentCatalog";
import { customerItemName } from "./customerCopy";

// Public rendering uses a local snapshot. Checkout revalidates the live provider catalog.
const originalServices = buildConfiguredCatalog(MASTER_SERVICE_CATALOG, snapshot, mappings).map(service => ({ ...service, name: customerItemName(service.id, service.name) }));
export const services = process.env.FULFILLMENT_MODE === "manual" ? originalServices : automaticRetailCatalog(savedProviderCatalog).services;
export const servicesVerifiedAt = metadata.verifiedAt;
