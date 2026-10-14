import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { websiteInquiryUrl } from "../config/site";

export default function WebDevUpsellBanner() {
  return (
    <section id="web-development" aria-labelledby="web-heading" className="scroll-mt-24 bg-[#FAFAFA] pb-16 sm:pb-20">
      <div className="page-container">
        <div className="flex flex-col items-start justify-between gap-7 rounded-lg border border-slate-300 bg-white p-6 sm:p-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl"><p className="eyebrow">Website design</p><h2 id="web-heading" className="mt-3 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">Need a website for your business?</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">We build portfolios, business websites and online stores. Tell us what you need and we’ll discuss the scope, price and timeline.</p><Link href="/website-design" className="mt-4 inline-block text-sm font-semibold text-blue-700 underline underline-offset-4">Explore website design &amp; development</Link></div>
          <a href={websiteInquiryUrl} className="button-primary min-h-12 shrink-0 px-5 py-3.5 text-sm"><MessageCircle size={17} aria-hidden="true" />Discuss your website<ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
