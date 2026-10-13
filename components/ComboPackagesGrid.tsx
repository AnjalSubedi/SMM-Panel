import { ArrowRight, Check } from "lucide-react";
import { formatPrice, packages, type CatalogItem } from "../lib/catalog";
import PlatformIcon from "./PlatformIcon";

export default function ComboPackagesGrid({ onOrder }: { onOrder: (item: CatalogItem) => void }) {
  return <section id="packages" aria-labelledby="packages-heading" className="section-space scroll-mt-24 border-b border-zinc-200 bg-white">
    <div className="page-container">
      <div id="pricing" className="scroll-mt-28"><p className="eyebrow">A stronger start</p><h2 id="packages-heading" className="section-heading mt-3">Monetization &amp; Growth Bundles</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">Packs designed to hit monetization thresholds and boost real engagement.</p></div>
      <div className="mt-12 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-5">
        {packages.map(bundle => {
          const featured = bundle.packageCode === "D";
          const platform = featured ? "YouTube" : bundle.packageCode === "C" ? "Instagram" : "Facebook";
          return <article key={bundle.id} data-package={bundle.packageCode} className={"flex min-w-0 flex-col justify-between gap-8 rounded-md border p-5 lg:p-6 " + (featured ? "border-zinc-950 bg-zinc-950 text-white md:col-span-3 xl:col-span-2" : "border-zinc-200 bg-white text-zinc-900")}>
            <div>
              <div className="flex items-center justify-between gap-2"><span className={"flex size-9 shrink-0 items-center justify-center rounded-md border " + (featured ? "border-zinc-700 text-white" : "border-zinc-200 text-zinc-700")}><PlatformIcon platform={platform} className="size-[18px]" /></span><span className={"rounded-sm border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider " + (featured ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 text-zinc-600")}>{featured ? "Featured package" : bundle.badge}</span></div>
              <p className={"mt-7 font-mono text-[10px] font-semibold uppercase tracking-widest " + (featured ? "text-blue-300" : "text-blue-600")}>Package {bundle.packageCode}</p>
              <h3 className={"mt-3 font-bold leading-tight tracking-tight " + (featured ? "max-w-lg text-2xl sm:text-3xl" : "text-lg md:min-h-24")}>{featured ? "YouTube Partner Program Complete" : bundle.name}</h3>
              <p className={"mt-4 text-xs leading-6 " + (featured ? "text-zinc-300" : "text-zinc-500 md:min-h-18")}>{bundle.target}</p>
              <p className={"mt-7 font-mono font-bold tracking-tight " + (featured ? "text-4xl" : "text-[28px]")}>{formatPrice(bundle.price)}</p><p className={"mt-2 text-[11px] " + (featured ? "text-zinc-400" : "text-zinc-500")}>One-time package</p>
              <ul className={"mt-6 space-y-3 border-t pt-6 " + (featured ? "border-zinc-700" : "border-zinc-200")}>{bundle.inclusions.map(feature => <li key={feature} className={"flex gap-2 text-xs leading-6 " + (featured ? "text-zinc-200" : "text-zinc-600")}><Check size={14} className={"mt-1 shrink-0 " + (featured ? "text-blue-400" : "text-blue-600")} aria-hidden="true" />{feature}</li>)}</ul>
            </div>
            <button type="button" aria-haspopup="dialog" aria-label={"Order Bundle " + bundle.packageCode + ": " + bundle.name} onClick={() => onOrder(bundle)} className={"inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors " + (featured ? "border-blue-600 bg-blue-600 text-white hover:border-blue-500 hover:bg-blue-500" : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-900 hover:bg-zinc-50")}>Order Bundle<ArrowRight size={15} aria-hidden="true" /></button>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
