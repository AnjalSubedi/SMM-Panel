import { ArrowRight, ArrowUpRight, Check, CircleCheck, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { supportUrl } from "../config/site";
import { formatPrice, type CatalogItem } from "../lib/catalog";

export default function HeroSection({ preview }: { preview: CatalogItem }) {
  return (
    <section aria-labelledby="hero-heading" className="hero-surface overflow-hidden border-b border-slate-200/80">
      <div className="page-container grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16 lg:py-24">
        <div>
          <div className="reveal inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 sm:text-xs"><ShieldCheck size={14} aria-hidden="true" />Verified Nepali Growth Infrastructure</div>
          <h1 id="hero-heading" className="reveal mt-6 text-4xl font-extrabold leading-[1.12] tracking-[-0.045em] text-slate-900 md:text-6xl">Audience acquisition <span className="text-blue-600">&amp; page monetization</span> for Nepali creators and brands.</h1>
          <p className="reveal mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Audience growth, watch time, and monetization services for Nepali creators. Pay directly with eSewa or use your account wallet. No social passwords required.</p>
          <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#calculator" className="button-primary px-5 py-3.5 text-sm">Explore Growth Catalog<ArrowRight size={17} aria-hidden="true" /></a>
            <a href={supportUrl} className="button-secondary px-5 py-3.5 text-sm"><MessageCircle size={17} aria-hidden="true" />Chat on WhatsApp</a>
          </div>
          <dl className="mt-9 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 pt-6">
            <div className="pr-3"><dt className="text-[10px] text-slate-500 sm:text-xs">Social passwords</dt><dd className="mt-1.5 font-mono text-lg font-bold text-slate-900">0%</dd></div>
            <div className="px-3 sm:px-5"><dt className="text-[10px] text-slate-500 sm:text-xs">Dispatch speed</dt><dd className="mt-1.5 font-mono text-lg font-bold text-slate-900">1–6h</dd></div>
            <div className="pl-3 sm:pl-5"><dt className="text-[10px] text-slate-500 sm:text-xs">Local settlement</dt><dd className="mt-1.5 text-xs font-bold leading-5 text-slate-900 sm:text-sm">eSewa &amp; Account Wallet</dd></div>
          </dl>
        </div>
        <div className="reveal relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-3 -z-0 rounded-[24px] border border-blue-100 bg-blue-50/60 sm:-inset-5" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
            <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="status-dot size-2 rounded-full bg-emerald-500" />Live Order Guarantee</span><ShieldCheck size={20} className="text-emerald-600" aria-hidden="true" /></div>
            <div className="mt-6 flex items-end justify-between gap-3 border-b border-slate-100 pb-6"><div><p className="text-xs font-medium text-slate-500">Successful delivery</p><p className="mt-2 font-mono text-4xl font-bold tracking-tight text-slate-900">99.8<span className="text-2xl text-slate-400">%</span></p></div><span className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><CircleCheck size={12} aria-hidden="true" />Delivery assurance</span></div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Order preview</span><span className="font-mono">NPR</span></div>
              <h2 className="mt-3 text-sm font-semibold leading-6 text-slate-800">{preview.name}</h2>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3"><span className="text-xs text-slate-500">{preview.unitLabel}</span><span className="font-mono text-xl font-bold text-blue-600">{formatPrice(preview.price)}</span></div>
            </div>
            <div className="mt-5 grid gap-3 text-xs text-slate-600"><p className="flex items-center gap-2"><Check size={15} aria-hidden="true" className="text-emerald-600" />Orders tracked in your account</p><p className="flex items-center gap-2"><Check size={15} aria-hidden="true" className="text-emerald-600" />Pay in Nepalese Rupees</p></div>
            <a href="#calculator" className="button-primary mt-6 w-full px-4 py-3 text-sm">Calculate your order<ArrowUpRight size={16} aria-hidden="true" /></a>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><LockKeyhole size={11} aria-hidden="true" />Your account stays yours. Always.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
