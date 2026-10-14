import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { servicePages } from "../lib/servicePages";
import PlatformBrandLogo from "./PlatformBrandLogo";
import PlatformIcon from "./PlatformIcon";

export default function ServiceDiscovery() {
  return <section className="section-space border-t border-slate-200 bg-white" aria-labelledby="platform-guides-heading"><div className="page-container">
    <div className="max-w-2xl"><p className="eyebrow">Find the right service</p><h2 id="platform-guides-heading" className="section-heading mt-3">Social media boosting in Nepal.</h2><p className="mt-4 text-sm leading-7 text-slate-600">Digital Marketing NP helps creators and businesses compare social media services and website design. Start with your platform to see prices in NPR, order limits and what to check before paying.</p></div>
    <div className="mt-8 grid gap-x-10 md:grid-cols-2">{servicePages.map(page => <Link key={page.slug} href={"/services/" + page.slug} className="group flex items-start gap-4 border-t border-slate-200 py-6">
      <span className="mt-1 text-blue-600">{page.platform === "TikTok" ? <PlatformIcon platform={page.platform} className="size-7" /> : <PlatformBrandLogo platform={page.platform} className="size-7" />}</span><div className="min-w-0 flex-1"><h3 className="text-base font-semibold tracking-tight text-slate-900 group-hover:text-blue-700">{page.platform} services & prices</h3><p className="mt-2 text-sm leading-6 text-slate-600">{page.intro}</p></div><ArrowUpRight size={18} className="mt-1 shrink-0 text-slate-500 group-hover:text-blue-700" aria-hidden="true" />
    </Link>)}</div>
    <p className="mt-4 text-sm leading-7 text-slate-600">Also available: Telegram, X, LinkedIn, Spotify, Discord and website traffic. <Link href="/services#service-directory" className="font-semibold text-blue-700 underline underline-offset-4">Compare all services</Link>.</p>
  </div></section>;
}
