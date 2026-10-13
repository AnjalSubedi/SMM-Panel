import { MASTER_SERVICE_CATALOG } from "../config/catalogData";
import snapshot from "../data/suvakrio-services.json";
import mappings from "../config/serviceQuantityMappings.json";
import metadata from "../data/suvakrio-services.meta.json";
import { buildConfiguredCatalog } from "./providerCatalog";
import { customerItemName } from "./customerCopy";

// Local public-page snapshot only: no provider requests when loading or ordering.
export const services = buildConfiguredCatalog(MASTER_SERVICE_CATALOG, snapshot, mappings).map(service => ({ ...service, name: customerItemName(service.id, service.name) }));
export const servicesVerifiedAt = metadata.verifiedAt;
