// Phase 8.9 SEO checks on dist/: one H1, unique title + description (140 to 158 chars on
// indexable pages), canonical, OG + Twitter tags, JSON-LD that parses with the expected
// @types, alt on every <img>, GA4 placeholder, sitemap contents. Usage: node scripts/seo-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { ROOT } from './lib/assets.mjs';

const DIST = path.join(ROOT, 'dist');
const walk = (d, o = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p, o) : o.push(p); } return o; };
const files = walk(DIST).filter((f) => f.endsWith('.html') && !f.includes(`${path.sep}admin${path.sep}`));
const expectTypes = (rel) => {
  const base = ['WebSite', 'Person', 'ProfessionalService', 'BreadcrumbList'];
  if (rel === 'index.html') return [...base, 'WebPage'];
  if (rel.startsWith('about/')) return [...base, 'ProfilePage'];
  if (rel.startsWith('speaking/')) return [...base, 'Service'];
  if (rel.startsWith('dr-roz-collaborations/')) return [...base, 'Service'];
  if (rel.startsWith('contact-us/')) return [...base, 'ContactPage'];
  if (rel === 'blog/index.html' || rel.startsWith('blog/page/')) return [...base, 'Blog', 'ItemList'];
  if (rel.startsWith('category/')) return [...base, 'CollectionPage', 'ItemList'];
  if (/^\d{4}\//.test(rel)) return [...base, 'BlogPosting'];
  return ['WebSite', 'Person', 'ProfessionalService'];
};

const problems = [];
const titles = new Map();
const descs = new Map();
let imgs = 0;
for (const f of files) {
  const rel = path.relative(DIST, f).split(path.sep).join('/');
  const html = fs.readFileSync(f, 'utf8');
  const { document } = parseHTML(html);
  const p = (m) => problems.push(`${rel}: ${m}`);
  const noindex = !!document.querySelector('meta[name="robots"][content*="noindex"]');
  const h1s = document.querySelectorAll('h1').length;
  if (h1s !== 1) p(`${h1s} <h1>`);
  const title = document.querySelector('title')?.textContent?.trim();
  const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  if (!title) p('no title');
  if (!desc) p('no description');
  if (!noindex && (desc.length < 140 || desc.length > 155)) p(`description ${desc.length} chars`);
  if (!noindex) {
    titles.set(title, [...(titles.get(title) || []), rel]);
    descs.set(desc, [...(descs.get(desc) || []), rel]);
  }
  const canon = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  if (!/^https:\/\/drrozcohen\.com\//.test(canon)) p(`canonical "${canon}"`);
  for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) if (!document.querySelector(`meta[property="${prop}"]`)) p(`missing ${prop}`);
  for (const n of ['twitter:card', 'twitter:image']) if (!document.querySelector(`meta[name="${n}"]`)) p(`missing ${n}`);
  const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const ogLocal = path.join(DIST, new URL(ogImg).pathname);
  if (!fs.existsSync(ogLocal)) p(`og:image file missing ${ogImg}`);
  if (!html.includes('<!-- GA4: G-XXXXXXXXXX -->')) p('GA4 placeholder missing');
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')];
  if (!ld.length) p('no JSON-LD');
  const types = new Set();
  for (const s of ld) {
    try {
      const j = JSON.parse(s.textContent);
      for (const node of j['@graph'] || [j]) [].concat(node['@type']).forEach((t) => types.add(t));
    } catch (e) { p(`JSON-LD parse error ${e.message}`); }
  }
  for (const t of expectTypes(rel)) if (!types.has(t)) p(`JSON-LD missing ${t}`);
  for (const img of document.querySelectorAll('img')) {
    imgs++;
    if (!img.hasAttribute('alt')) p(`img without alt ${img.getAttribute('src')}`);
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) p(`img without width/height ${img.getAttribute('src')}`);
  }
}
for (const [t, where] of titles) if (where.length > 1) problems.push(`duplicate title "${t}" on ${where.join(', ')}`);
for (const where of descs.values()) if (where.length > 1) problems.push(`duplicate description on ${where.join(', ')}`);

// Sitemap
const sm = fs.readFileSync(path.join(DIST, 'sitemap-0.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
if (locs.some((l) => /^\/(admin|dev|og|thank-you)\//.test(l) || /404/.test(l))) problems.push('sitemap lists excluded paths');
const posts = locs.filter((l) => /^\/\d{4}\//.test(l)).length;
const pagesIn = ['/', '/about/', '/speaking/', '/dr-roz-collaborations/', '/blog/', '/contact-us/'].filter((x) => locs.includes(x)).length;
if (posts !== 53) problems.push(`sitemap has ${posts} posts`);
if (pagesIn !== 6) problems.push(`sitemap has ${pagesIn}/6 main pages`);
const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
if (!/Disallow: \/admin\//.test(robots) || !/Sitemap: https:\/\/drrozcohen\.com\/sitemap-index\.xml/.test(robots)) problems.push('robots.txt incomplete');

console.log(`HTML pages: ${files.length}. Images checked: ${imgs}. Sitemap URLs: ${locs.length} (${posts} posts, ${pagesIn} main pages).`);
if (problems.length) { console.log(problems.join('\n')); console.log(`FAIL: ${problems.length}`); process.exitCode = 1; }
else console.log('PASS: one H1, unique titles/descriptions, canonical, OG/Twitter, JSON-LD types, alt + dimensions, GA4 placeholder, sitemap, robots');
