import { ArrowRight, Check } from "lucide-react";
import { formatPrice, packages, type CatalogItem } from "../lib/catalog";
import PlatformIcon from "./PlatformIcon";

export default function ComboPackagesGrid({ onOrder }: { onOrder: (item: CatalogItem) => void }) {
  return (
    <section id="packages" aria-labelledby="packages-heading" className="section-space scroll-mt-24 border-b border-slate-200 bg-white">
      <div className="page-container">
        <div id="pricing" className="scroll-mt-28">
          <p className="eyebrow">A stronger start</p>
          <h2 id="packages-heading" className="section-heading mt-3">Monetization &amp; Growth Bundles</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">Curated high-margin bundles engineered for maximum organic traction.</p>
        </div>
        <div className="mt-9 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((bundle, index) => (
            <article key={bundle.id} className={`relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-6 transition-shadow hover:shadow-lg ${index === 0 ? "border-2 border-blue-600 shadow-md ring-1 ring-blue-600/20" : "border border-slate-200 shadow-sm"}`}>
              {index === 0 && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-blue-600" />}
              <div>
                <div className="flex h-9 items-center justify-between gap-2"><span className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700"><PlatformIcon platform={index === 3 ? "YouTube" : index === 2 ? "Instagram" : "Facebook"} className="size-[18px]" /></span><span className={`rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${index === 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{index === 0 ? "Most popular" : bundle.badge}</span></div>
                <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-widest text-blue-600">Package {bundle.packageCode}</p>
                <h3 className="mt-2 text-lg font-bold leading-6 tracking-tight text-slate-900 lg:min-h-24">{bundle.name}</h3>
                <p className="mt-3 text-xs leading-5 text-slate-500 lg:min-h-15">{bundle.target}</p>
                <p className="mt-5 font-mono text-[28px] font-bold tracking-tight text-slate-900">{formatPrice(bundle.price)}</p>
                <p className="mt-1 text-[11px] text-slate-500">One-time package</p>
                <ul className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                  {bundle.inclusions.map((feature) => <li key={feature} className="flex gap-2 text-xs leading-5 text-slate-600"><Check size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{feature}</li>)}
                </ul>
              </div>
              <button type="button" aria-haspopup="dialog" aria-label={`Order Bundle ${bundle.packageCode}: ${bundle.name}`} onClick={() => onOrder(bundle)} className={`mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors ${index === 0 ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-900 hover:bg-slate-800"}`}>Order Bundle<ArrowRight size={15} aria-hidden="true" /></button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
