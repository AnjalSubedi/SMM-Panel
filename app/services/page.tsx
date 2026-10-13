import GrowthCatalog from "../../components/GrowthCatalog";
import WebDevUpsellBanner from "../../components/WebDevUpsellBanner";
import { services } from "../../lib/services";
export default function ServicesPage() {
  return <><div className="page-container border-b border-zinc-200 py-20 sm:py-28"><p className="eyebrow">Growth services</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Build your next growth order.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-zinc-500">Choose a platform, compare services, and pay directly with eSewa or your account wallet.</p><a href="#calculator" className="button-primary mt-5 min-h-11 px-5 text-sm">Configure a service</a></div><GrowthCatalog services={services} /><WebDevUpsellBanner /></>;
}
