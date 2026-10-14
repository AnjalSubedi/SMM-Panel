import type { MetadataRoute } from "next";
import { isPreview, siteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return isPreview
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/admin"] }, sitemap: siteUrl + "/sitemap.xml" };
}
