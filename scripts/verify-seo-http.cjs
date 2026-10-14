const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const base = process.env.SEO_BASE_URL || 'http://localhost:3002';
  const canonical = 'https://www.digitalmarketingnp.me';
  const paths = ['/', '/services', '/services/facebook', '/services/instagram', '/services/youtube', '/services/tiktok', '/website-design'];
  const titles = new Set();
  for (const path of paths) {
    const response = await fetch(base + path, { headers: { 'User-Agent': 'Googlebot' } });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    fs.writeFileSync(".qa/seo-page-" + (path.replaceAll("/", "-") || "home") + ".html", html);
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    assert.ok(title?.includes('Digital Marketing NP'), path + ' title: ' + title); titles.add(title);
    assert.ok(html.includes('<link rel="canonical" href="' + canonical + (path === '/' ? '' : path) + '"'), path + ' canonical');
    assert.match(html, /<meta name="description" content="[^"]{60,}"/);
    assert.match(html, /<meta name="robots" content="index, follow"/);
    assert.match(html, /<meta property="og:image" content="https:\/\/www.digitalmarketingnp.me\/opengraph-image/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
    const visibleHtml = html.replace(/<script[\s\S]*?<\/script>/g, '');
    assert.equal((visibleHtml.match(/<h1(?:\s|>)/g) || []).length, 1, path + ' one H1');
    const structured = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert.ok(structured.length, path + ' structured data');
    assert.ok(structured.every(item => item['@context'] === 'https://schema.org'));
    if (path.startsWith('/services/')) {
      assert.ok(visibleHtml.includes('<table'), path + ' pricing without JavaScript');
      assert.ok(visibleHtml.includes('NPR '), path + ' NPR pricing');
      assert.ok(structured.some(item => item['@type'] === 'Service'));
    }
    if (path === '/services') {
      assert.equal((visibleHtml.match(/<tbody(?:\s|>)/g) || []).length, 9, 'All nine platforms have server-rendered pricing tables');
      assert.equal((visibleHtml.match(/<th scope="row"/g) || []).length, 58, 'All 58 services have visible HTML pricing');
      assert.ok(visibleHtml.includes('Will these services guarantee monetization or real customers?'));
    }
    if (path === '/') assert.ok(structured.some(item => item['@graph']?.some(entity => entity['@type'] === 'Organization')));
  }
  assert.equal(titles.size, paths.length, 'Unique titles across public routes');
  const robots = await (await fetch(base + '/robots.txt')).text();
  assert.ok(robots.includes('Allow: /')); assert.ok(robots.includes('Disallow: /api/')); assert.ok(robots.includes('Sitemap: ' + canonical + '/sitemap.xml'));
  const sitemap = await (await fetch(base + '/sitemap.xml')).text();
  for (const path of paths) assert.ok(sitemap.includes('<loc>' + canonical + (path === '/' ? '' : path) + '</loc>'));
  assert.equal((sitemap.match(/<loc>/g) || []).length, paths.length);
  assert.ok(!/account|login|register|admin|password|api|resumeOrder/.test(sitemap));
  for (const path of ['/login', '/register', '/forgot-password', '/reset-password']) {
    const html = await (await fetch(base + path)).text();
    assert.match(html, /<meta name="robots" content="noindex, nofollow, nocache"/);
    assert.ok(!html.includes('rel="canonical"'), 'Private page must not inherit home canonical');
  }
  const api = await fetch(base + '/api/account'); assert.equal(api.status, 401); assert.equal(api.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal((await fetch(base + '/services/unknown-platform')).status, 404);
  const image = await fetch(base + '/opengraph-image'); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
  const bytes = Buffer.from(await image.arrayBuffer()); assert.equal(bytes.readUInt32BE(16), 1200); assert.equal(bytes.readUInt32BE(20), 630);
  require('node:fs').writeFileSync('.qa/social-preview.png', bytes);
  const brand = await fetch(base + '/brand-mark.svg'); assert.equal(brand.status, 200); assert.ok((await brand.text()).includes('width="256"'));
  console.log('SEO HTTP checks passed: seven canonical routes, all 58 prices in HTML, JSON-LD, noindex auth, sitemap, robots, 404s and 1200x630 share image.');
})().catch(error => { console.error(error); process.exitCode = 1; });
