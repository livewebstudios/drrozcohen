// Phase 8.3 kill-list scan over strings LWS authored.
//  1. Source: every .astro/.tsx/.ts/.mjs/.css file under src/ (excluding client copy in
//     src/data/pages/ and src/content/blog/) for em/en dashes and banned phrases.
//  2. Built output: alt text, aria-labels, <title>-less authored meta (descriptions, og:alt)
//     on every page in dist/.
// Usage: node scripts/killlist.mjs
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { ROOT } from './lib/assets.mjs';

const BANNED = [/—/, /–/, /learn more/i, /click here/i, /\bsubmit\b/i, /don.t hesitate to reach out/i, /circle back/i, /schedule a free consultation/i, /read more/i];
// Code identifiers that contain "submit" but are never shown to people.
const CODE_OK = /type="submit"|onSubmit|cform__submit|\.submit\b/g;

const walk = (dir, out = []) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const hits = [];
const srcFiles = walk(path.join(ROOT, 'src')).filter(
  (f) => /\.(astro|tsx?|mjs|css)$/.test(f) && !f.includes(`${path.sep}data${path.sep}pages${path.sep}`) && !f.includes(`${path.sep}content${path.sep}blog${path.sep}`),
);
for (const f of srcFiles) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const l = line.replace(CODE_OK, '');
    BANNED.forEach((re) => re.test(l) && hits.push(`${path.relative(ROOT, f)}:${i + 1}  ${re}  ${line.trim().slice(0, 120)}`));
  });
}

// Alt text in blog frontmatter is authored by LWS even though it lives in content/blog.
for (const f of walk(path.join(ROOT, 'src', 'content', 'blog'))) {
  const m = fs.readFileSync(f, 'utf8').match(/^featuredAlt: (.*)$/m);
  if (m) BANNED.forEach((re) => re.test(m[1]) && hits.push(`${path.relative(ROOT, f)} featuredAlt ${re}`));
}

let pages = 0;
for (const f of walk(path.join(ROOT, 'dist')).filter((f) => f.endsWith('.html') && !f.includes(`${path.sep}admin${path.sep}`))) {
  pages++;
  const { document } = parseHTML(fs.readFileSync(f, 'utf8'));
  const strings = [
    ...[...document.querySelectorAll('img[alt]')].map((e) => ['alt', e.getAttribute('alt')]),
    ...[...document.querySelectorAll('[aria-label]')].map((e) => ['aria-label', e.getAttribute('aria-label')]),
    ...[...document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[property="og:image:alt"], meta[name="twitter:image:alt"]')].map((e) => ['meta', e.getAttribute('content')]),
  ];
  for (const [kind, s] of strings) BANNED.forEach((re) => re.test(s || '') && hits.push(`${path.relative(ROOT, f)} ${kind} ${re}: ${s}`));
}

console.log(`Source files scanned: ${srcFiles.length}. Built pages scanned: ${pages}.`);
if (hits.length) {
  console.log(hits.join('\n'));
  console.log(`FAIL: ${hits.length} hits`);
  process.exitCode = 1;
} else console.log('PASS: zero hits');
