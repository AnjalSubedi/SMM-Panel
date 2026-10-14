import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { breadcrumbData, publicPageMetadata, privateRobots, serializeJsonLd, siteUrl } from "../lib/seo";
import { servicePages } from "../lib/servicePages";
import { services } from "../lib/services";

test("sitemap contains only canonical public routes", () => {
  const urls = sitemap().map(item => item.url);
  assert.equal(urls.length, 8);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(url => url === siteUrl || url.startsWith(siteUrl + "/")));
  assert.ok(urls.every(url => !/account|admin|login|register|password|api|resumeOrder/.test(url)));
  assert.equal(robots().sitemap, siteUrl + "/sitemap.xml");
});
test("each public page has its own canonical and share metadata", () => {
  const descriptions = new Set<string>();
  for (const page of servicePages) {
    const path = "/services/" + page.slug;
    const metadata = publicPageMetadata(page.title, page.description, path);
    assert.equal(metadata.alternates?.canonical, siteUrl + path);
    assert.equal(metadata.description, page.description);
    assert.ok(metadata.openGraph && "url" in metadata.openGraph);
    assert.equal(metadata.openGraph.url, siteUrl + path);
    assert.ok(metadata.twitter && "card" in metadata.twitter);
    assert.equal(metadata.twitter.card, "summary_large_image");
    assert.ok(services.some(service => service.platform === page.platform));
    descriptions.add(page.description);
  }
  assert.equal(descriptions.size, servicePages.length);
  assert.deepEqual(privateRobots, { index: false, follow: false, nocache: true });
});
test("JSON-LD safely escapes script-closing text and round-trips Unicode", () => {
  const payload = { text: "</script><script>alert(1)</script>" + String.fromCharCode(0x2028, 0x2029) };
  const serialized = serializeJsonLd(payload);
  assert.ok(!serialized.includes("<"));
  assert.deepEqual(JSON.parse(serialized), payload);
  const breadcrumbs = breadcrumbData([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]);
  assert.deepEqual(breadcrumbs.itemListElement.map(item => item.position), [1, 2]);
  assert.equal(breadcrumbs.itemListElement[1].item, siteUrl + "/services");
});
test("Vercel previews are excluded from indexing and sitemap discovery", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", 'const robots = require("./app/robots.ts").default; const sitemap = require("./app/sitemap.ts").default; const { publicPageMetadata } = require("./lib/seo.ts"); console.log(JSON.stringify({robots:robots(),sitemap:sitemap(),metadata:publicPageMetadata("Preview","Preview","/services")}));'], { encoding: "utf8", env: { ...process.env, VERCEL_ENV: "preview", SUVAKRIO_API_KEY: "" }, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.robots.rules, { userAgent: "*", disallow: "/" });
  assert.deepEqual(data.sitemap, []);
  assert.equal(data.metadata.robots.index, false);
  assert.equal(data.metadata.alternates.canonical, siteUrl + "/services");
});
