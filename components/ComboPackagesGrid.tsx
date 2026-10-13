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
          <p className="eyebrow">Choose a package</p>
          <h2 id="packages-heading" className="section-heading mt-3">Followers, views &amp; watch-time packages</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">Each package shows the quantities you get and the total price. Choose one that fits what you need.</p>
        </div>
        <div className="mt-9 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((bundle) => {
            const platforms = bundlePlatforms[bundle.packageCode as keyof typeof bundlePlatforms] ?? bundlePlatforms.A;
            const highlighted = bundle.packageCode === "A";
            return (
              <article key={bundle.id} aria-labelledby={bundle.id + "-title"} className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white ${highlighted ? "border-blue-600" : "border-slate-300"}`}>
                <div className="border-b border-slate-200 bg-white p-5">
                  <div className="flex min-h-11 items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {platforms.map((platform) => <span key={platform} className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white"><PlatformBrandLogo platform={platform} className="size-8" /></span>)}
                    </div>
                    <span className={`rounded-md px-2 py-1.5 text-[10px] font-semibold ${highlighted ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{bundle.badge}</span>
                  </div>
                  <p className="mt-5 text-xs font-medium text-slate-600">Package {bundle.packageCode} <span aria-hidden="true">/</span> {platforms.length > 1 ? "Two platforms" : platforms[0]}</p>
                  <h3 id={bundle.id + "-title"} className="mt-2 text-lg font-bold leading-6 tracking-tight text-slate-900 xl:min-h-18">{bundle.name}</h3>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-semibold text-slate-600">What you get</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-b border-slate-200 pb-5 [&>div]:flex [&>div]:flex-col">
                    {bundle.inclusions.slice(0, 2).map((feature) => <IncludedMetric key={feature} feature={feature} />)}
                  </dl>
                  <ul className="mt-4 space-y-2.5">
                    {bundle.inclusions.slice(2).map((feature) => <li key={feature} className="flex gap-2 text-xs font-medium leading-5 text-slate-800"><Check size={15} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />{feature}</li>)}
                  </ul>
                  <p className="mt-5 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-900">Good for: </span>{bundle.target}.</p>
                  <div className="mt-auto pt-6">
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-xs font-semibold text-slate-600">Package price</p>
                      <p className="mt-1 font-mono text-[28px] font-bold tracking-tight text-slate-950">{formatPrice(bundle.price)}</p>
                      <p className="mt-1 text-xs text-slate-600">One-time payment · No subscription</p>
                    </div>
                    <button type="button" aria-haspopup="dialog" aria-label={`Choose package ${bundle.packageCode}: ${bundle.name}`} onClick={() => onOrder(bundle)} className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${highlighted ? "border border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "border border-blue-200 bg-white text-blue-700 hover:border-blue-400 hover:bg-blue-50"}`}>Choose package<ArrowRight size={15} aria-hidden="true" /></button>
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
        <p className="mt-4 max-w-3xl text-xs leading-5 text-slate-600">A refill replaces followers that drop during the stated period. Contact us with your order number if you need one. Facebook and YouTube decide monetization eligibility; buying followers or watch time does not guarantee approval.</p>
      </div>
    </section>
  );
}
