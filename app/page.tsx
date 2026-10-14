import ServiceDiscovery from "../components/ServiceDiscovery";
import StructuredData from "../components/StructuredData";
import { publicPageMetadata, siteName, siteUrl } from "../lib/seo";
import { site, supportUrl } from "../config/site";
import { packages } from "../lib/catalog";
import { redirect } from "next/navigation";
import HeroSection from "../components/HeroSection";
import GrowthCatalog from "../components/GrowthCatalog";
import WebDevUpsellBanner from "../components/WebDevUpsellBanner";
import { currentUser } from "../lib/server/access";
import { services } from "../lib/services";
export const metadata = publicPageMetadata("Social Media Boosting in Nepal", "Compare Facebook, Instagram, YouTube and TikTok services in Nepal. Clear prices in NPR, eSewa payment and website design for creators and businesses.", "/");
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function HomePage({ searchParams }: { searchParams: Promise<{ resumeOrder?: string }> }) {
  const query = await searchParams;
  if (query.resumeOrder === "1") redirect("/services?resumeOrder=1#calculator");
  if (await currentUser()) redirect("/account");
  return <><StructuredData data={{ "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": siteUrl + "/#organization", name: siteName, url: siteUrl, logo: { "@type": "ImageObject", url: siteUrl + "/brand-mark.svg", width: 256, height: 256 }, telephone: "+" + site.whatsappNumber, description: "Social media services and website design for creators and businesses in Nepal.", contactPoint: { "@type": "ContactPoint", telephone: "+" + site.whatsappNumber, contactType: "customer support", url: supportUrl, areaServed: "NP", availableLanguage: "English" } },
    { "@type": "WebSite", "@id": siteUrl + "/#website", url: siteUrl, name: siteName, inLanguage: "en", publisher: { "@id": siteUrl + "/#organization" } },
  ] }} /><HeroSection preview={services[0]} /><GrowthCatalog services={services} bundles={packages} /><ServiceDiscovery /><WebDevUpsellBanner /></>;
}
