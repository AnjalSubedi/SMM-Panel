import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import StructuredData from "../../components/StructuredData";
import { websiteInquiryUrl } from "../../config/site";
import { breadcrumbData, publicPageMetadata, siteName, siteUrl } from "../../lib/seo";

const title = "Website Design & Development in Nepal";
const description = "Personal portfolios, business websites and online stores for businesses in Nepal. Discuss your pages, features, budget and timeline with Digital Marketing NP.";
export const metadata = publicPageMetadata(title, description, "/website-design");
const websiteTypes = [
  { title: "Personal portfolios", text: "A place to introduce yourself, show your work and make it easy for people to contact you. Suitable for freelancers, creators and independent professionals." },
  { title: "Business websites", text: "Explain your services, answer common questions and give customers a clear way to inquire. We plan the pages around the information your customers need." },
  { title: "Online stores", text: "Show products and plan the shopping, ordering and payment flow. The right setup depends on your catalog, payment requirements and how you handle orders." },
];
export default function WebsiteDesignPage() {
  return <>
    <StructuredData data={breadcrumbData([{ name: "Home", path: "/" }, { name: "Website design", path: "/website-design" }])} />
    <StructuredData data={{ "@context": "https://schema.org", "@type": "Service", name: title, description, serviceType: "Website design and development", url: siteUrl + "/website-design", areaServed: { "@type": "Country", name: "Nepal" }, provider: { "@type": "Organization", "@id": siteUrl + "/#organization", name: siteName, url: siteUrl } }} />
    <section className="border-b border-slate-200 bg-white"><div className="page-container py-14 sm:py-20"><nav aria-label="Breadcrumb" className="mb-8 flex gap-2 text-xs text-slate-600"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Website design</span></nav><p className="eyebrow">Website design & development in Nepal</p><h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">A website that makes your business easy to understand.</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">Tell us what you do, who your customers are and what your website needs to help them do. We build portfolios, business websites and online stores, with the scope and price discussed before work begins.</p><a href={websiteInquiryUrl} className="button-primary mt-7 min-h-12 px-5 text-sm">Discuss your website<ArrowUpRight size={17} aria-hidden="true" /></a></div></section>
    <section className="section-space" aria-labelledby="website-types-heading"><div className="page-container"><h2 id="website-types-heading" className="section-heading">What are you building?</h2><div className="mt-8 grid gap-8 md:grid-cols-3">{websiteTypes.map(type => <div key={type.title} className="border-t border-slate-200 pt-6"><h3 className="text-xl font-semibold tracking-tight">{type.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{type.text}</p></div>)}</div></div></section>
    <section className="section-space border-y border-slate-200 bg-white" aria-labelledby="website-process-heading"><div className="page-container grid gap-8 lg:grid-cols-2"><div><p className="eyebrow">Start with a clear brief</p><h2 id="website-process-heading" className="section-heading mt-3">Agree on the work before it starts.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">There is no single price that fits every website. A small portfolio and an online store need different pages, features and testing.</p></div><ol className="space-y-6">{[
      ["Tell us what you need", "Send your business name, the kind of website you want, any examples you like and the main action you want visitors to take."],
      ["Review the scope and quote", "We discuss the pages, features, content, budget and timeline. Hosting, domain setup and ongoing updates should be agreed as part of the scope."],
      ["Review and launch", "Review the design and content before launch. Confirm the mobile layout, contact details and any forms or ordering features."],
    ].map(([heading, text], index) => <li key={heading} className="flex gap-4 border-t border-slate-200 pt-5"><span className="font-mono text-sm font-bold text-blue-700">0{index + 1}</span><div><h3 className="font-semibold">{heading}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{text}</p></div></li>)}</ol></div></section>
    <section className="section-space"><div className="page-container"><div className="flex flex-col items-start justify-between gap-6 rounded-lg border border-slate-300 bg-white p-6 sm:p-8 md:flex-row md:items-center"><div><h2 className="text-2xl font-bold tracking-tight">Have a project in mind?</h2><p className="mt-3 text-sm leading-7 text-slate-600">Send the details on WhatsApp: +977 9744505435.</p></div><a href={websiteInquiryUrl} className="button-primary min-h-12 shrink-0 px-5 text-sm">Ask for a website quote<ArrowUpRight size={17} aria-hidden="true" /></a></div><p className="mt-7 text-sm text-slate-600">Looking for followers, views or watch time? <Link href="/services" className="font-semibold text-blue-700 underline underline-offset-4">Browse social media services</Link>.</p></div></section>
  </>;
}
