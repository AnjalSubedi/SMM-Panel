import { ArrowRight, Check, CreditCard, LockKeyhole } from "lucide-react";
import { formatPrice, packages, type CatalogItem } from "../lib/catalog";
import PlatformBrandLogo from "./PlatformBrandLogo";

const bundlePlatforms = {
  A: ["Facebook"],
  B: ["Facebook", "Instagram"],
  C: ["Instagram", "Facebook"],
  D: ["YouTube"],
} as const;

function IncludedMetric({ feature }: { feature: string }) {
  const match = feature.match(/^([\d,]+)\s+(.+)$/);
  return <div className="min-w-0">
    <dt className="mt-1.5 text-xs font-medium leading-5 text-slate-700">{match?.[2] ?? feature}</dt>
    {match && <dd className="-order-1 font-mono text-2xl font-bold tracking-tight text-slate-950 sm:text-[26px]">{match[1]}</dd>}
  </div>;
}

export default function ComboPackagesGrid({ onOrder }: { onOrder: (item: CatalogItem) => void }) {
  return (
    <section id="packages" aria-labelledby="packages-heading" className="section-space scroll-mt-24 border-y border-slate-200 bg-slate-50">
      <div className="page-container">
        <div id="pricing" className="scroll-mt-28">
          <p className="eyebrow">More growth. One package.</p>
          <h2 id="packages-heading" className="section-heading mt-3">Monetization &amp; Growth Bundles</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">Compare followers, views, and watch time in one pack. See exactly what’s included, then pay once with eSewa or your account wallet.</p>
        </div>
        <div className="mt-9 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((bundle) => {
            const platforms = bundlePlatforms[bundle.packageCode as keyof typeof bundlePlatforms] ?? bundlePlatforms.A;
            const popular = bundle.packageCode === "A";
            return (
              <article key={bundle.id} aria-labelledby={bundle.id + "-title"} className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white ${popular ? "border-blue-600" : "border-slate-300"}`}>
                <div className="border-b border-slate-800 bg-slate-950 p-5">
                  <div className="flex min-h-11 items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {platforms.map((platform) => <span key={platform} className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white"><PlatformBrandLogo platform={platform} className="size-8" /></span>)}
                    </div>
                    <span className={`rounded-sm px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider ${popular ? "bg-blue-600 text-white" : "border border-slate-600 text-slate-200"}`}>{popular ? "Most popular" : bundle.packageCode === "D" ? "Channel growth" : bundle.packageCode === "C" ? "Reels & reach" : bundle.badge}</span>
                  </div>
                  <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Package {bundle.packageCode} <span aria-hidden="true">/</span> {platforms.length > 1 ? "Multi-platform" : platforms[0]}</p>
                  <h3 id={bundle.id + "-title"} className="mt-2 text-lg font-bold leading-6 tracking-tight text-white xl:min-h-12">{bundle.name}</h3>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Included in your pack</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-200 pb-5 [&>div]:flex [&>div]:flex-col">
                    {bundle.inclusions.slice(0, 2).map((feature) => <IncludedMetric key={feature} feature={feature} />)}
                  </dl>
                  <ul className="mt-4 space-y-2.5">
                    {bundle.inclusions.slice(2).map((feature) => <li key={feature} className="flex gap-2 text-xs font-medium leading-5 text-slate-800"><Check size={15} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />{feature}</li>)}
                  </ul>
                  <p className="mt-5 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-900">Built for: </span>{bundle.target}.</p>
                  <div className="mt-auto pt-6">
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Total package price</p>
                      <p className="mt-1 font-mono text-[28px] font-bold tracking-tight text-slate-950">{formatPrice(bundle.price)}</p>
                      <p className="mt-1 text-xs text-slate-600">One-time payment · No subscription</p>
                    </div>
                    <button type="button" aria-haspopup="dialog" aria-label={`Order Bundle ${bundle.packageCode}: ${bundle.name}`} onClick={() => onOrder(bundle)} className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white transition-colors ${popular ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-900 hover:bg-slate-800"}`}>Order Bundle<ArrowRight size={15} aria-hidden="true" /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-b border-slate-200 pb-5 text-xs font-medium text-slate-700">
          <p className="flex items-center gap-2"><LockKeyhole size={14} className="text-blue-600" aria-hidden="true" />No social account passwords required</p>
          <p className="flex items-center gap-2"><CreditCard size={14} className="text-blue-600" aria-hidden="true" />Pay with eSewa or wallet balance</p>
        </div>
        <p className="mt-4 max-w-3xl text-xs leading-5 text-slate-600">Facebook and YouTube decide monetization eligibility. Purchasing a package does not guarantee approval.</p>
      </div>
    </section>
  );
}
