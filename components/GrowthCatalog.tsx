"use client";

import { useEffect, useState } from "react";
import { packages, type CatalogItem } from "../lib/catalog";
import { prepareServiceOrder } from "../lib/order";
import ComboPackagesGrid from "./ComboPackagesGrid";
import InteractiveServiceDirectory from "./InteractiveServiceDirectory";
import CheckoutModal from "./CheckoutModal";

export default function GrowthCatalog({ services }: { services: CatalogItem[] }) {
  const [order, setOrder] = useState<CatalogItem | null>(null);
  useEffect(() => {
    const location = new URL(window.location.href);
    if (location.searchParams.get("resumeOrder") !== "1") return;
    try {
      const draft = JSON.parse(sessionStorage.getItem("dmnp-checkout-draft") || "null");
      const bundle = packages.find((item) => item.id === draft?.itemId);
      const service = services.find((item) => item.id === draft?.itemId);
      if (bundle) setOrder(bundle);
      else if (service && Number.isInteger(draft.quantity) && draft.quantity >= (service.min ?? 1) && draft.quantity <= (service.max ?? 1)) setOrder(prepareServiceOrder(service, draft.quantity));
    } catch { /* Ignore invalid browser drafts. */ }
    location.searchParams.delete("resumeOrder");
    window.history.replaceState(window.history.state, "", location.pathname + location.search + location.hash);
  }, [services]);
  return <><ComboPackagesGrid onOrder={setOrder} /><InteractiveServiceDirectory services={services} onOrder={setOrder} />{order && <CheckoutModal item={order} onDismiss={() => setOrder(null)} />}</>;
}
