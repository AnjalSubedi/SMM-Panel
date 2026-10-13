import HeroSection from "../components/HeroSection";
import GrowthCatalog from "../components/GrowthCatalog";
import WebDevUpsellBanner from "../components/WebDevUpsellBanner";
import { services } from "../lib/services";

export default function HomePage() {
  return <><HeroSection preview={services[0]} /><GrowthCatalog services={services} /><WebDevUpsellBanner /></>;
}
