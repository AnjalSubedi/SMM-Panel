import { ArrowUpRight, Code2, MessageCircle } from "lucide-react";
import { websiteInquiryUrl } from "../config/site";

export default function WebDevUpsellBanner() {
  return (
    <section id="web-development" aria-labelledby="web-heading" className="scroll-mt-24 bg-[#FAFAFA] pb-16 sm:pb-20">
      <div className="page-container">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-7 text-white shadow-xl shadow-slate-200 md:p-10">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-500 via-emerald-400 to-slate-700" />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl"><div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300"><Code2 size={16} aria-hidden="true" />Beyond social growth</div><h2 id="web-heading" className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Need a custom personal portfolio or business website?</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">We design and engineer lightning-fast modern websites, creator portfolios, and custom web platforms in Nepal.</p></div>
            <a href={websiteInquiryUrl} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-lg transition-colors hover:bg-emerald-600"><MessageCircle size={17} aria-hidden="true" />Let&apos;s talk on WhatsApp<ArrowUpRight size={17} aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </section>
  );
}
