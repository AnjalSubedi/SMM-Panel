import type { Metadata } from "next";

// One public host for canonicals, sharing and structured data. Never use a preview URL.
export const siteUrl = "https://www.digitalmarketingnp.me";
export const siteName = "Digital Marketing NP";
export const isPreview = process.env.VERCEL_ENV === "preview";
export const privateRobots: Metadata["robots"] = { index: false, follow: false, nocache: true };

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  const url = siteUrl + (path === "/" ? "" : path);
  const shareTitle = title + " | " + siteName;
  const images = [{ url: siteUrl + "/opengraph-image", width: 1200, height: 630, alt: "Digital Marketing NP - social media services and website design in Nepal" }];
  return {
    title: { absolute: shareTitle }, description,
    alternates: { canonical: url },
    robots: isPreview ? privateRobots : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: { type: "website", locale: "en_NP", siteName, url, title: shareTitle, description, images },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}

export function serializeJsonLd(data: unknown): string {
  // Escape HTML before embedding JSON in a script element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function breadcrumbData(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: siteUrl + item.path })) };
}
