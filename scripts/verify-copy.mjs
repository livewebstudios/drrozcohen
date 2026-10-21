// Phase 8.2 copy integrity: every sentence of every page block in the content file must
// appear in the built HTML text (<main>) of its page. Scraper annotations are skipped and
// "label — text" lines are checked as their separate parts. Usage: node scripts/verify-copy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { ROOT } from './lib/assets.mjs';

const CONTENT = path.join(ROOT, '..', 'drrozcohen_full_site_content.txt');
const PAGES = {
  HOME: 'index.html',
  ABOUT: 'about/index.html',
  SPEAKING: 'speaking/index.html',
  'CONTACT US': 'contact-us/index.html',
  'DR. ROZ COLLABORATIONS': 'dr-roz-collaborations/index.html',
  'BLOG INDEX': 'blog/index.html',
};

const norm = (s) =>
  s
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/…/g, '...')
    .toLowerCase()
    .replace(/[^a-z0-9#&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const text = fs.readFileSync(CONTENT, 'utf8');
const pageSection = text.split('SECTION 2: BLOG ARTICLES')[0];
const blocks = pageSection.split(/^-{20,}\s*$/m);

/** Turn one content-file line into the strings that must appear on the page. */
function units(line) {
  let l = line.trim();
  if (!l) return [];
  if (/^(URL|Fields|Categories|OUTBOUND LINKS):/.test(l)) return [];
  if (/^Blog description\/tagline/.test(l)) return [];
  if (/^- https?:\/\//.test(l)) return [];
  l = l.replace(/\((various media outlets|various organizations|none|internal blog article URLs and category pages)\)/g, '');
  l = l.replace(/^(QUOTE|TESTIMONIAL):\s*/, '').replace(/^- /, '').replace(/^— /, '');
  // Label lines: "#1 — Title", "KEYNOTE 1 — Title", "DR. ROZ COHEN — A Career Snapshot", "01 — TITLE"
  let parts = l.split(/\s+—\s+(?=[A-Z#0-9"])/);
  // Attribution after a closing quote: "...good." — Ruth Bader Ginsburg
  parts = parts.flatMap((p) => p.split(/(?<=[."”])\s+—\s+/));
  // All-caps label lines with a colon: "SESSION #1: CREATING...", "SOCIUS STRATEGIES: WAYS..."
  parts = parts.flatMap((p) => (p === p.toUpperCase() && /: /.test(p) ? p.split(/:\s+/) : [p]));
  // Sentences
  return parts
    .flatMap((p) => p.split(/(?<=[.!?…])\s+(?=["“A-Z*])/))
    .map((s) => s.trim())
    .filter((s) => norm(s).length > 0);
}

let totalMiss = 0;
const report = [];
for (let i = 0; i < blocks.length; i++) {
  const m = blocks[i].match(/^PAGE: (.+)$/m);
  if (!m) continue;
  const name = m[1].trim();
  const file = PAGES[name];
  const body = blocks[i + 1] || '';
  const html = fs.readFileSync(path.join(ROOT, 'dist', file), 'utf8');
  const { document } = parseHTML(html);
  const main = document.querySelector('main');
  main.querySelectorAll('script, style, template').forEach((n) => n.remove());
  // Add spaces at element boundaries so adjacent spans do not glue words together.
  const pageText = ' ' + norm(main.innerHTML.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z]+;|&#\d+;/g, ' ')) + ' ';
  const checks = body.split('\n').flatMap(units);
  const misses = checks.filter((c) => !pageText.includes(' ' + norm(c) + ' ') && !pageText.includes(norm(c)));
  totalMiss += misses.length;
  report.push({ page: name, checked: checks.length, missed: misses.length });
  misses.forEach((x) => console.log(`  MISS [${name}] ${x}`));
}
console.table(report);
console.log(totalMiss ? `FAIL: ${totalMiss} missing` : 'PASS: zero misses');
if (totalMiss) process.exitCode = 1;
