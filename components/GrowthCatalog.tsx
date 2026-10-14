"use client";

import { Suspense, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { CatalogItem } from "../lib/catalog";
import { prepareServiceOrder } from "../lib/order";
import { checkoutPaths } from "../lib/checkoutNavigation";
import InteractiveServiceDirectory from "./InteractiveServiceDirectory";

const noBundles: readonly CatalogItem[] = [];
const ComboPackagesGrid = dynamic(() => import("./ComboPackagesGrid"));
const CheckoutModal = dynamic(() => import("./CheckoutModal"), {
  ssr: false,
  loading: () => <p role="status" className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"><Loader2 size={15} className="animate-spin" aria-hidden="true" />Opening checkout…</p>,
});
const prepareCheckout = () => { void import("./CheckoutModal").catch(() => undefined); };

// Only this URL observer needs client rendering; keep the catalog server-rendered.
function ResumeCheckout({ services, bundles, dashboard, onRestore }: { services: CatalogItem[]; bundles: readonly CatalogItem[]; dashboard: boolean; onRestore: Dispatch<SetStateAction<CatalogItem | null>> }) {
  const resume = useSearchParams().get("resumeOrder");
  useEffect(() => {
    if (resume !== "1") return;
    const location = new URL(window.location.href);
    try {
      const draft = JSON.parse(sessionStorage.getItem("dmnp-checkout-draft") || "null");
      const bundle = bundles.find((item) => item.id === draft?.itemId);
      const service = services.find((item) => item.id === draft?.itemId);
      if (bundle && !dashboard) onRestore(bundle);
      else if (service && Number.isInteger(draft.quantity) && draft.quantity >= (service.min ?? 1) && draft.quantity <= (service.max ?? 1)) onRestore(prepareServiceOrder(service, draft.quantity));
    } catch { /* Ignore invalid browser drafts. */ }
    location.searchParams.delete("resumeOrder");
    window.history.replaceState(window.history.state, "", location.pathname + location.search + location.hash);
  }, [resume, services, bundles, dashboard, onRestore]);
  return null;
}

export default function GrowthCatalog({ services, bundles = noBundles, dashboard = false, showPackages = true, initialPlatform, onOrderPlaced }: { services: CatalogItem[]; bundles?: readonly CatalogItem[]; dashboard?: boolean; showPackages?: boolean; initialPlatform?: string; onOrderPlaced?: () => Promise<void> }) {
  const [order, setOrder] = useState<CatalogItem | null>(null);
  return <>
    <Suspense fallback={null}><ResumeCheckout services={services} bundles={bundles} dashboard={dashboard} onRestore={setOrder} /></Suspense>
    {!dashboard && showPackages && <ComboPackagesGrid packages={bundles} onOrder={setOrder} onPrepareCheckout={prepareCheckout} />}
    <InteractiveServiceDirectory services={services} onOrder={setOrder} compact={dashboard} initialPlatform={initialPlatform} onPrepareCheckout={prepareCheckout} />
    {order && <CheckoutModal item={order} onDismiss={() => setOrder(null)} returnTo={dashboard ? checkoutPaths.account : checkoutPaths.services} onOrderPlaced={onOrderPlaced} />}
  </>;
}
