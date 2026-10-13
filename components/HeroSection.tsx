import { ArrowRight, Check, LockKeyhole, MessageCircle } from "lucide-react";
import { supportUrl } from "../config/site";
import { formatPrice, type CatalogItem } from "../lib/catalog";

export default function HeroSection({ preview }: { preview: CatalogItem }) {
  return (
    <section aria-labelledby="hero-heading" className="border-b border-slate-200 bg-white">
      <div className="page-container grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14 lg:py-24">
        <div>
          <p className="eyebrow">Social media services in Nepal</p>
          <h1 id="hero-heading" className="mt-5 max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight text-slate-900 md:text-5xl lg:text-[54px]">Followers, views <span className="text-blue-600">and watch time.</span><br />Choose what your page needs.</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">Pick a service, choose your quantity and see the price before you pay. Use eSewa or your account balance. We’ll never ask for your social media password.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#calculator" className="button-primary px-5 py-3.5 text-sm">See services &amp; prices<ArrowRight size={17} aria-hidden="true" /></a>
            <a href={supportUrl} className="button-secondary px-5 py-3.5 text-sm"><MessageCircle size={17} aria-hidden="true" />Ask us on WhatsApp</a>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-slate-200 pt-5">
            <div><dt className="text-[11px] text-slate-500">What we need</dt><dd className="mt-2 text-xs font-semibold leading-5 text-slate-800">Your public page or video link</dd></div>
            <div><dt className="text-[11px] text-slate-500">eSewa payments</dt><dd className="mt-2 text-xs font-semibold leading-5 text-slate-800">Checked by our team</dd></div>
            <div><dt className="text-[11px] text-slate-500">Order updates</dt><dd className="mt-2 text-xs font-semibold leading-5 text-slate-800">In your account</dd></div>
          </dl>
        </div>
        <aside aria-labelledby="order-preview-heading" className="mx-auto w-full max-w-lg rounded-lg border border-slate-300 bg-slate-50 p-5 sm:p-6">
          <p className="text-xs font-semibold text-blue-700">Before you order</p>
          <h2 id="order-preview-heading" className="mt-2 text-xl font-bold tracking-tight text-slate-900">Know what you’re paying for</h2>
          <div className="mt-5 border-y border-slate-200 py-5">
            <p className="text-xs text-slate-500">Example service</p>
            <h3 className="mt-2 text-sm font-semibold leading-6 text-slate-900">{preview.name}</h3>
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2"><p className="font-mono text-3xl font-bold tracking-tight text-blue-700">{formatPrice(preview.price)}</p><p className="text-xs text-slate-600">{preview.unitLabel}</p></div>
          </div>
          <ol className="mt-5 space-y-4 text-sm">
            {["Choose a platform and service.", "Add your public link and check the total.", "Pay with eSewa or your wallet."].map((step, index) => <li key={step} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700">{index + 1}</span><span className="leading-6 text-slate-700">{step}</span></li>)}
          </ol>
          <p className="mt-5 flex items-start gap-2 border-t border-slate-200 pt-4 text-xs leading-6 text-slate-600"><Check size={15} className="mt-1 shrink-0 text-blue-600" aria-hidden="true" />Sign in before ordering to keep your orders and payment updates together.</p>
          <a href="#calculator" className="button-primary mt-5 w-full px-4 py-3 text-sm">Choose a service<ArrowRight size={16} aria-hidden="true" /></a>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-600"><LockKeyhole size={12} aria-hidden="true" />No social media password needed</p>
        </aside>
      </div>
    </section>
  );
}
