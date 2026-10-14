import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GrowthCatalog from "../../../components/GrowthCatalog";
import ServicePriceTable from "../../../components/ServicePriceTable";
import StructuredData from "../../../components/StructuredData";
import { servicePages } from "../../../lib/servicePages";
import { services } from "../../../lib/services";
import { breadcrumbData, publicPageMetadata, siteName, siteUrl } from "../../../lib/seo";
import { supportUrl } from "../../../config/site";

type Props = { params: Promise<{ platform: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return servicePages.map(page => ({ platform: page.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  const page = servicePages.find(page => page.slug === platform);
  if (!page) notFound();
  return publicPageMetadata(page.title, page.description, "/services/" + page.slug);
}
export default async function PlatformServicesPage({ params }: Props) {
  const { platform } = await params;
  const page = servicePages.find(page => page.slug === platform);
  if (!page) notFound();
  const items = services.filter(service => service.platform === page.platform);
  return <>
    <StructuredData data={breadcrumbData([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }, { name: page.platform, path: "/services/" + page.slug }])} />
    <StructuredData data={{ "@context": "https://schema.org", "@type": "Service", name: page.title, description: page.description, serviceType: page.platform + " social media services", url: siteUrl + "/services/" + page.slug, areaServed: { "@type": "Country", name: "Nepal" }, provider: { "@type": "Organization", "@id": siteUrl + "/#organization", name: siteName, url: siteUrl } }} />
    <section className="border-b border-slate-200 bg-white"><div className="page-container py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap gap-2 text-xs text-slate-600"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">{page.platform}</span></nav>
      <p className="eyebrow">{page.platform} services in Nepal</p><h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">{page.heading}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">{page.intro}</p>
      <div className="mt-7 flex flex-wrap gap-3"><a href="#calculator" className="button-primary min-h-12 px-5 text-sm">Choose a {page.platform} service</a><a href="#prices" className="button-secondary min-h-12 px-5 text-sm">Compare prices</a></div>
    </div></section>
    <GrowthCatalog key={page.slug} services={items} showPackages={false} initialPlatform={page.platform} />
    <section id="prices" className="section-space scroll-mt-24 border-y border-slate-200 bg-white" aria-labelledby="platform-prices-heading"><div className="page-container"><h2 id="platform-prices-heading" className="section-heading">{page.platform} prices in NPR.</h2><p className="mb-7 mt-4 max-w-2xl text-sm leading-7 text-slate-600">Compare {items.length} services below. The rate applies to the unit shown. Your total depends on the quantity you choose in the calculator.</p><ServicePriceTable services={items} label={page.platform} /></div></section>
    <section className="section-space" aria-labelledby="platform-notes-heading"><div className="page-container"><h2 id="platform-notes-heading" className="text-2xl font-bold tracking-tight">Before ordering {page.platform} services.</h2><div className="mt-7 grid gap-8 md:grid-cols-3">{page.notes.map(note => <div key={note.title} className="border-t border-slate-200 pt-5"><h3 className="font-semibold tracking-tight">{note.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{note.text}</p></div>)}</div>
      <p className="mt-9 text-sm leading-7 text-slate-600">Pay directly with eSewa or use your account wallet. eSewa payments are reviewed by our team before approval. No social media password is required. <a href={supportUrl} className="font-semibold text-blue-700 underline underline-offset-4">Ask about a service</a>.</p>
      <nav aria-label="Other platforms" className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-6 text-sm font-semibold text-blue-700">{servicePages.filter(other => other.slug !== page.slug).map(other => <Link key={other.slug} href={"/services/" + other.slug}>{other.platform} services</Link>)}<Link href="/services#service-directory">All platforms & prices</Link></nav>
    </div></section>
  </>;
}
