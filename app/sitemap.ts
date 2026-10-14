import type { MetadataRoute } from "next";
import { isPreview, siteUrl } from "../lib/seo";
import { servicePages } from "../lib/servicePages";

export default function sitemap(): MetadataRoute.Sitemap {
  if (isPreview) return [];
  return ["/", "/services", ...servicePages.map(page => "/services/" + page.slug), "/website-design"].map(path => ({ url: siteUrl + (path === "/" ? "" : path) }));
}
