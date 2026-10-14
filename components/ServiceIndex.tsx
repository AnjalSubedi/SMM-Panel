import Link from "next/link";
import type { CatalogItem } from "../lib/catalog";
import { platformOrder } from "../lib/catalogFormat";
import { servicePages } from "../lib/servicePages";
import ServicePriceTable from "./ServicePriceTable";

export default function ServiceIndex({ services }: { services: readonly CatalogItem[] }) {
  return <section id="service-directory" className="section-space scroll-mt-24 border-t border-slate-200 bg-white" aria-labelledby="directory-heading"><div className="page-container">
    <p className="eyebrow">Compare before you order</p><h2 id="directory-heading" className="section-heading mt-3">The full service price list.</h2>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">Open a platform to compare rates and quantity limits. Rates are shown for the unit listed, rather than a minimum order. Use the calculator above to see your exact total.</p>
    <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">{platformOrder.map(platform => {
      const items = services.filter(service => service.platform === platform);
      if (!items.length) return null;
      const page = servicePages.find(page => page.platform === platform);
      return <details key={platform} className="group py-1"><summary className="cursor-pointer py-5 text-base font-semibold text-slate-900 marker:text-blue-600">{platform}<span className="ml-3 text-xs font-normal text-slate-500">{items.length} services</span></summary><div className="pb-6">
        {page && <Link href={"/services/" + page.slug} className="mb-4 inline-block text-sm font-semibold text-blue-700 underline underline-offset-4">{platform} prices and ordering guide</Link>}
        <ServicePriceTable services={items} label={platform} />
      </div></details>;
    })}</div>
  </div></section>;
}
