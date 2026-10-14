import ServiceIndex from "../../components/ServiceIndex";
import OrderQuestions from "../../components/OrderQuestions";
import ServiceDiscovery from "../../components/ServiceDiscovery";
import StructuredData from "../../components/StructuredData";
import { breadcrumbData, publicPageMetadata } from "../../lib/seo";
import { packages } from "../../lib/catalog";
import GrowthCatalog from "../../components/GrowthCatalog";
import WebDevUpsellBanner from "../../components/WebDevUpsellBanner";
import { services } from "../../lib/services";
export const metadata = publicPageMetadata("Social Media Services & Prices in Nepal", "Compare follower, like, view and watch-time prices across 9 platforms. See service quantity limits, packages and eSewa checkout with Digital Marketing NP.", "/services");
export default function ServicesPage() {
  return <><StructuredData data={breadcrumbData([{ name: "Home", path: "/" }, { name: "Services & prices", path: "/services" }])} /><div className="page-container border-b border-slate-200 py-10 sm:py-14"><p className="eyebrow">Social media services</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Services for your social pages.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">Choose a platform, compare services, and pay directly with eSewa or your account wallet.</p><a href="#calculator" className="button-primary mt-5 min-h-11 px-5 text-sm">Choose a service</a></div><GrowthCatalog services={services} bundles={packages} /><ServiceDiscovery /><ServiceIndex services={services} /><OrderQuestions /><WebDevUpsellBanner /></>;
}
