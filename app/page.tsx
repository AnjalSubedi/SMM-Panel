import { redirect } from "next/navigation";
import HeroSection from "../components/HeroSection";
import GrowthCatalog from "../components/GrowthCatalog";
import WebDevUpsellBanner from "../components/WebDevUpsellBanner";
import { currentUser } from "../lib/server/access";
import { services } from "../lib/services";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function HomePage({ searchParams }: { searchParams: Promise<{ resumeOrder?: string }> }) {
  const query = await searchParams;
  if (query.resumeOrder === "1") redirect("/services?resumeOrder=1#calculator");
  if (await currentUser()) redirect("/account");
  return <><HeroSection preview={services[0]} /><GrowthCatalog services={services} /><WebDevUpsellBanner /></>;
}
