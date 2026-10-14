# Search visibility

The canonical public site is https://www.digitalmarketingnp.me. Vercel should keep redirecting the bare domain to www. Production pages advertise this same host in canonical tags, Open Graph metadata, structured data and the sitemap.

## Search targets and useful landing pages

| Page | Main intent |
| --- | --- |
| / | Social media boosting in Nepal; Digital Marketing NP |
| /services | Social media service prices in Nepal; NPR pricing and eSewa |
| /services/facebook | Facebook followers, page likes, views and watch time in Nepal |
| /services/instagram | Instagram followers, reel views and likes in Nepal |
| /services/youtube | YouTube subscribers, views and watch time in Nepal |
| /services/tiktok | TikTok followers, likes and views in Nepal |
| /website-design | Portfolio, business website and online store development in Nepal |

These are real service pages with existing catalog data, distinct descriptions, ordering guidance and working checkout. The full /services price list renders all 58 services across nine platforms in the initial HTML. The platform price tables use the same data and units as the calculator. No provider requests are used to build these pages.

The public pages include descriptive titles, descriptions, canonical URLs, Open Graph/Twitter cards, one primary heading, crawlable internal links, and Organization/WebSite, Service or BreadcrumbList structured data as appropriate. Structured data describes existing business facts; it does not claim ratings, a physical address, guaranteed platform approval or guaranteed Google rich results.

## Connect Google Search Console after deployment

1. Open https://search.google.com/search-console and select Add property.
2. Choose Domain and enter digitalmarketingnp.me, without https or www.
3. Copy the TXT verification value Google provides.
4. In Namecheap, open Domain List → Manage → Advanced DNS → Add New Record. Add a TXT record with Host @, Value equal to Google's complete verification value, and automatic TTL. Keep the existing A and CNAME records.
5. Save, return to Google and click Verify. DNS verification may require time to propagate. Keep the TXT record after verification.
6. In Search Console → Sitemaps, submit https://www.digitalmarketingnp.me/sitemap.xml.
7. Use URL Inspection on the homepage, /services and the platform pages. Test the live URL, check that crawling is allowed and that the canonical is correct, then request indexing if needed.

Alternative: add a URL-prefix property for https://www.digitalmarketingnp.me/ and choose HTML tag verification. Set GOOGLE_SITE_VERIFICATION to just the token from the tag's content attribute in Vercel Production as Config, redeploy, then verify. This token is public and is separate from Google OAuth credentials. DNS verification of a Domain property does not need this environment variable.

Owner verification, sitemap submission and indexing requests require access to the owner's Google account. Adding SEO code does not perform these actions or guarantee indexing.

## Indexing boundaries

- /robots.txt allows public pages and assets and lists the sitemap. It discourages crawling /api/, /account and /admin.
- Sign-in, registration and password recovery pages carry noindex/nofollow metadata. Account and admin layouts inherit the same policy for their child pages. Authentication and authorization remain the actual access controls.
- API responses carry X-Robots-Tag: noindex, nofollow.
- VERCEL_ENV=preview generates a disallow-all robots file, an empty sitemap and noindex metadata/response headers. Preview deployments must be built as Preview, rather than redeploying a production artifact under a preview hostname.
- Public query variations, such as checkout resume URLs, canonicalize to the clean page URL. No private URL is listed in the sitemap. There are no fabricated last-modified timestamps.

## Keep improving using evidence

Review Search Console impressions, queries, clicks, indexed pages and Core Web Vitals after Google has crawled the update. Compare similar date ranges and countries. Prioritize useful explanations for questions customers actually ask, real examples of work with customer permission, accurate business/contact details and genuine relevant mentions from other sites. Keep prices, availability and delivery information current.

Do not buy backlinks, publish fake reviews, stuff city/keyword variations into pages, or generate hundreds of near-identical landing pages. Broader searches such as digital marketing are competitive and may imply services beyond this site's current social media and website offerings. Publish new service pages only when the business actually offers and can explain those services.

Google chooses whether, when and where a page ranks. Technical changes, a sitemap and structured data cannot guarantee first position. Search results may take weeks or longer to reflect improvements.

## Checks

- npm run test:seo — sitemap/public metadata, safe JSON-LD and preview policy; local catalog only.
- npm run build — verifies production rendering and static platform pages.
- npm run test:seo:production — after build, runs HTTP and hidden Chrome checks against a disposable local PostgreSQL instance. Confirms all public routes, crawlable prices, metadata, sitemap, robots, share image, mobile widths, platform selection and checkout opening. Does not submit orders/payments and disables provider credentials.

## Primary guidance

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://support.google.com/webmasters/answer/9008080
- https://support.google.com/webmasters/answer/7451001
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
