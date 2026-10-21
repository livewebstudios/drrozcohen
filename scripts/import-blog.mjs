// Phase 2 blog importer.
//
//   node scripts/import-blog.mjs discover   fetch post list (WP REST) + post HTML, write blog-assets.json
//   node scripts/import-blog.mjs convert    turn cached HTML into src/content/blog/<slug>.md
//
// Run `discover`, then `node scripts/fetch-assets.mjs`, then `convert` (convert needs the
// assets manifest so every image URL maps to a local file).
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { ROOT, RAW_DIR, MANIFEST, BLOG_ASSETS, sleep, originalUrl, fetchOk } from './lib/assets.mjs';

const API = 'https://drrozcohen.com/wp-json/wp/v2';
const HTML_DIR = path.join(RAW_DIR, 'html');
const META = path.join(ROOT, 'scripts', 'blog-posts.json');
const ALT = path.join(ROOT, 'scripts', 'blog-alt.json');
const OUT = path.join(ROOT, 'src', 'content', 'blog');


const LI_DIR = path.join(HTML_DIR, 'linkedin');
const BULLET = /^[•·-]\s*/;

/** Convert a LinkedIn embed's commentary (whitespace-pre-wrap text) to Markdown, verbatim. */
function linkedinMarkdown(td, file) {
  const { document } = parseHTML(readFileSync(file, 'utf8'));
  const el = document.querySelector('[data-test-id="main-feed-activity-embed-card__commentary"]');
  if (!el) throw new Error(`No commentary in ${file}`);
  // Inline links: hashtags become plain text, mentions keep their link without tracking params.
  const inline = (node) => [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return td.escape(n.textContent);
    if (n.nodeName === 'A') {
      const href = (n.getAttribute('href') || '').replace(/[?&]trk=[^&]*/, '');
      if (/feed%2Fhashtag|\/feed\/hashtag\//.test(n.getAttribute('href') || '') || /^#/.test(n.textContent.trim())) return n.textContent;
      return `[${td.escape(n.textContent)}](${href})`;
    }
    if (n.nodeName === 'BR') return '\n';
    return inline(n);
  }).join('');
  const lines = inline(el).replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  let list = null; // { ordered, items }
  const flushPara = () => { if (para.length) out.push(para.join('\\\n')); para = []; };
  const flushList = () => {
    if (list) out.push(list.items.map((t, i) => (list.ordered ? `${i + 1}. ` : '- ') + t).join('\n'));
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const plain = line.replace(/^\\/, '');
    const ord = plain.match(/^(\d+)\\?[.)]\s+(.*)$/);
    if (ord) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ord[2]);
      continue;
    }
    if (BULLET.test(plain)) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(plain.replace(BULLET, ''));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return out.join('\n\n');
}

const decode = (s) => parseHTML(`<!doctype html><html><body><p>${s}</p></body></html>`).document.querySelector('p').textContent;

async function json(url) {
  const res = await fetchOk(url);
  await sleep(250);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function contentRoot(document) {
  const el = document.querySelector('.et_pb_post_content');
  if (!el) throw new Error('no .et_pb_post_content');
  el.querySelectorAll('script, style, noscript, iframe').forEach((n) => n.remove());
  return el;
}

function bodyImages(el) {
  return [...el.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter(Boolean);
}

async function discover() {
  await fs.mkdir(HTML_DIR, { recursive: true });
  const cats = await json(`${API}/categories?per_page=100&_fields=id,name,slug`);
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const posts = await json(`${API}/posts?per_page=100&_fields=id,date,date_gmt,slug,link,title,categories,featured_media`);
  const meta = [];
  const assets = new Set();
  for (const p of posts) {
    let featured = null;
    if (p.featured_media) {
      const m = await json(`${API}/media/${p.featured_media}?_fields=source_url,alt_text`);
      featured = { url: m.source_url, alt: m.alt_text || '' };
      assets.add(m.source_url);
    }
    const file = path.join(HTML_DIR, `${p.slug}.html`);
    if (!existsSync(file)) {
      const res = await fetchOk(p.link);
      await sleep(250);
      if (!res.ok) throw new Error(`${res.status} ${p.link}`);
      await fs.writeFile(file, await res.text());
    }
    const { document } = parseHTML(await fs.readFile(file, 'utf8'));
    const htmlCats = [...document.querySelectorAll('a[rel="category tag"]')].map((a) => a.textContent.trim());
    const restCats = p.categories.map((id) => catById[id]);
    // Primary first: the order the live post lists them, falling back to REST order.
    const ordered = htmlCats.length
      ? htmlCats.map((n) => restCats.find((c) => c.name === decode(n)) || { name: decode(n), slug: '' })
      : restCats;
    const imgs = bodyImages(contentRoot(document));
    imgs.forEach((u) => assets.add(u));
    if (!featured) {
      // Theme-builder header image (outside the content module) as the featured image.
      const hdr = [...document.querySelectorAll('img[class*="wp-image-"]')].map((i) => i.getAttribute('src'))
        .find((u) => u && !/logo/.test(u) && !imgs.includes(u));
      if (hdr) { featured = { url: hdr, alt: '' }; assets.add(hdr); }
    }
    meta.push({
      id: p.id, slug: p.slug, link: p.link, date: p.date_gmt + 'Z', localDate: p.date,
      title: decode(p.title.rendered), categories: ordered.map((c) => c.name), categorySlugs: ordered.map((c) => c.slug),
      featured, bodyImages: imgs,
    });
    process.stdout.write('.');
  }
  meta.sort((a, b) => a.date.localeCompare(b.date));
  await fs.writeFile(META, JSON.stringify(meta, null, 2) + '\n');
  await fs.writeFile(BLOG_ASSETS, JSON.stringify([...assets], null, 2) + '\n');
  console.log(`\nPosts: ${meta.length}. Blog image URLs: ${assets.size}. Categories: ${cats.length}`);
}

function makeTurndown() {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**', codeBlockStyle: 'fenced' });
  td.remove(['script', 'style', 'noscript']);
  // Keep live line breaks as CommonMark hard breaks (trailing spaces get trimmed later).
  td.addRule('br', { filter: 'br', replacement: () => '\\\n' });
  return td;
}

/** Word-level similarity: 2 * LCS / (|a| + |b|). */
export function similarity(a, b) {
  if (!a.length && !b.length) return 1;
  const n = a.length, m = b.length;
  let prev = new Uint16Array(m + 1), cur = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return (2 * prev[m]) / (n + m);
}

export const normWords = (s) => s
  .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
  .replace(/[–—]/g, ' ').replace(/…/g, '...').replace(/ /g, ' ')
  .toLowerCase().replace(/[^a-z0-9'#@$%&+ ]+/g, ' ').split(/\s+/).filter(Boolean);

/** Markdown -> plain text (good enough for word comparison). */
export function mdText(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1')
    .replace(/[*_`>]/g, ' ');
}

async function convert() {
  const meta = JSON.parse(await fs.readFile(META, 'utf8'));
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const alts = existsSync(ALT) ? JSON.parse(await fs.readFile(ALT, 'utf8')) : {};
  const urlToLocal = new Map();
  for (const m of manifest) for (const u of [m.sourceUrl, m.fetchedUrl, ...m.aliases]) urlToLocal.set(originalUrl(u), m.local);
  const rel = (url) => {
    const local = urlToLocal.get(originalUrl(url.split('?')[0]));
    if (!local) throw new Error(`No local asset for ${url}`);
    return path.relative(OUT, path.join(ROOT, local)).split(path.sep).join('/');
  };
  await fs.mkdir(OUT, { recursive: true });
  const td = makeTurndown();
  const report = [];
  for (const p of meta) {
    const { document } = parseHTML(await fs.readFile(path.join(HTML_DIR, `${p.slug}.html`), 'utf8'));
    const root = contentRoot(document);
    // Unwrap presentational spans, keep their text.
    root.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
    // Merge adjacent bold/italic runs (<strong>a</strong><strong>.</strong>) and drop empty ones,
    // otherwise Markdown gets "**a****.**".
    for (const tag of ['strong', 'b', 'em', 'i']) {
      root.querySelectorAll(tag).forEach((el) => {
        if (!el.parentNode) return;
        if (!el.textContent.trim() && !el.querySelector('img')) { el.replaceWith(...el.childNodes); return; }
        let next = el.nextSibling;
        while (next && next.nodeType === 1 && next.tagName.toLowerCase() === tag) {
          el.append(...next.childNodes);
          next.remove();
          next = el.nextSibling;
        }
      });
    }
    // Headings: drop bold/italic wrappers, then shift levels so the body starts at H2
    // (the page H1 is the post title) and never skips a level.
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => h.querySelectorAll('strong,b,em,i').forEach((x) => x.replaceWith(...x.childNodes)));
    const levels = [...new Set([...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]))].sort();
    const remap = Object.fromEntries(levels.map((l, i) => [l, Math.min(2 + i, 6)]));
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
      const n = document.createElement('h' + remap[+h.tagName[1]]);
      n.innerHTML = h.innerHTML; h.replaceWith(n);
    });
    const featuredLocal = p.featured ? rel(p.featured.url) : null;
    root.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      const local = rel(src);
      // The live template already shows the featured image in the header; drop a duplicate.
      if (featuredLocal && local === featuredLocal) {
        const wrap = img.closest('.et_pb_image') || img;
        wrap.remove();
        return;
      }
      img.setAttribute('src', local);
      const inlineAlt = (alts.inline || {})[path.basename(local)];
      if (inlineAlt) img.setAttribute('alt', inlineAlt);
      img.removeAttribute('srcset'); img.removeAttribute('sizes');
    });
    root.querySelectorAll('a[href]').forEach((a) => {
      let href = a.getAttribute('href').trim();
      href = href.replace(/^https?:\/\/(www\.)?drrozcohen\.com/i, '') || '/';
      if (/^\/contact\/?$/.test(href)) href = '/contact-us/';
      a.setAttribute('href', href);
    });
    const liFile = path.join(LI_DIR, `${p.slug}.html`);
    const isLinkedIn = !root.textContent.trim() && existsSync(liFile);
    const liveText = isLinkedIn
      ? parseHTML(readFileSync(liFile, 'utf8')).document.querySelector('[data-test-id="main-feed-activity-embed-card__commentary"]').textContent
      : root.textContent;
    const html = await fs.readFile(path.join(HTML_DIR, `${p.slug}.html`), 'utf8');
    const liUrl = (html.match(/https:\/\/www\.linkedin\.com\/embed\/feed\/update\/[^"]+/) || [])[0];
    let md = (isLinkedIn ? linkedinMarkdown(td, liFile) : td.turndown(root.innerHTML))
      .replace(/ /g, ' ')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const plain = mdText(md).replace(/\s+/g, ' ').trim();
    const words = plain.split(' ').filter(Boolean);
    const excerpt = words.length ? words.slice(0, 28).join(' ').replace(/[,;:.!?]+$/, '') + '…' : '';
    const altEntry = (alts.featured || {})[p.slug];
    const fm = [
      '---',
      `title: ${JSON.stringify(p.title)}`,
      `date: ${p.date}`,
      `slug: ${JSON.stringify(p.slug)}`,
      `categories: ${JSON.stringify(p.categories)}`,
      ...(featuredLocal ? [`featuredImage: ${JSON.stringify(featuredLocal)}`, `featuredAlt: ${JSON.stringify(altEntry || p.featured.alt || '')}`] : []),
      `excerpt: ${JSON.stringify(excerpt)}`,
      `sourceUrl: ${JSON.stringify(p.link)}`,
      ...(isLinkedIn && liUrl ? [`linkedinEmbed: ${JSON.stringify(liUrl)}`] : []),
      '---',
      '',
    ].join('\n');
    await fs.writeFile(path.join(OUT, `${p.slug}.md`), fm + md + '\n');
    const simLive = similarity(normWords(plain), normWords(liveText));
    report.push({ slug: p.slug, source: isLinkedIn ? 'linkedin' : 'wp', words: words.length, simLive: +simLive.toFixed(4), images: (md.match(/!\[/g) || []).length });
  }
  console.table(report);
  await fs.writeFile(path.join(ROOT, 'scripts', 'blog-import-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${report.length} posts to ${path.relative(ROOT, OUT)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode === 'discover') await discover();
  else if (mode === 'convert') await convert();
  else console.log('usage: node scripts/import-blog.mjs discover|convert');
}
