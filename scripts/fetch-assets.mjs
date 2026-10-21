// Phase 1 asset pipeline.
// Downloads originals from drrozcohen.com (and cdn.b12.io for blog inline images) into
// images/raw/, processes them into src/assets/images/{brand,photos,blog}/ and writes
// scripts/assets-manifest.json. Idempotent: raw files already on disk are not re-fetched.
//
// Usage: node scripts/fetch-assets.mjs
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {
  ROOT, RAW_DIR, OUT_DIR, MANIFEST, BLOG_ASSETS, sleep, candidates, originalUrl, localName, fetchOk,
} from './lib/assets.mjs';

const U = 'https://drrozcohen.com/wp-content/uploads/';
const BRAND = [
  '2024/10/logo-trnsprnt.png', '2024/10/logo-1.png', '2024/10/logo-footer.png', '2024/10/cropped-dr-roz-logo-footer.png',
  '2024/10/Featured-In-logos.png', '2024/10/Trusted-By-logos.png', '2024/10/Past-Talks-logos.png',
].map((p) => U + p);
const PHOTOS = [
  '2024/10/roscohen_164-scaled.jpg', '2024/10/hands-scaled.jpg', '2024/10/central_park-scaled.jpg',
  '2024/10/roscohen_172-scaled.jpg', '2024/10/roscohen_46-scaled.jpg', '2024/10/roscohen_204.jpg',
  '2024/10/roscohen_80.jpg', '2024/10/rda_-_project_equity_-_fall_2023-117.jpg',
  '2024/10/rda_-_project_equity_-_fall_2023-98-scaled.jpg', '2024/10/let_s_talk.jpg',
  '2024/10/including_you_podcast.jpg', '2024/10/roscohen_86.jpg', '2024/10/roscohen_190-scaled.jpg',
  '2024/10/roscohen_75.jpg', '2024/10/dscf5118_2.jpg', '2024/10/shuk_-_israel-scaled.jpg',
  '2024/10/antioch_university.png',
].map((p) => U + p);
const BADGE = 'https://livewebstudios.com/images/verifiedsecured.png';
const PAGES = ['', 'about/', 'speaking/', 'dr-roz-collaborations/', 'blog/', 'contact-us/'];
const HERO_2000 = new Set(['roscohen_164.jpg']);
// Header logo keeps the LWS standard file name.
const RENAME = { 'logo-1.png': 'logoRGB.png' };
const UPLOAD_RE = /https?:(?:\\?\/){2}drrozcohen\.com(?:\\?\/)wp-content(?:\\?\/)uploads(?:\\?\/)[^"'()\s,<>]+?\.(?:jpe?g|png|gif|webp|svg)/gi;

async function getText(url) {
  const res = await fetchOk(url);
  await sleep(250);
  return res.ok ? res.text() : '';
}

async function scanLive() {
  const found = new Map(); // original url -> category
  const cssUrls = new Set();
  for (const p of PAGES) {
    const html = await getText(`https://drrozcohen.com/${p}`);
    for (const m of html.matchAll(UPLOAD_RE)) {
      const u = originalUrl(m[0].replace(/\\\//g, '/'));
      if (!found.has(u)) found.set(u, p === 'blog/' ? 'blog' : 'photos');
    }
    for (const m of html.matchAll(/https?:\/\/drrozcohen\.com\/wp-content\/et-cache\/[^"'\s)]+?\.css/g)) cssUrls.add(m[0]);
  }
  for (const css of cssUrls) {
    const text = await getText(css);
    for (const m of text.matchAll(UPLOAD_RE)) {
      const u = originalUrl(m[0]);
      if (!found.has(u)) found.set(u, 'photos');
    }
  }
  return { found, cssCount: cssUrls.size };
}

async function download(url) {
  for (const c of candidates(url)) {
    const rel = c.replace(/^https?:\/\//, '');
    const dest = path.join(RAW_DIR, rel);
    if (existsSync(dest)) return { fetchedUrl: c, file: dest };
    const res = await fetchOk(c);
    await sleep(250);
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !/image|octet-stream/.test(type)) continue;
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return { fetchedUrl: c, file: dest };
  }
  return null;
}

async function processOne(rawFile, category, name) {
  const buf = await fs.readFile(rawFile);
  const meta = await sharp(buf).metadata();
  const maxW = HERO_2000.has(name) ? 2000 : 1600;
  const outDir = path.join(OUT_DIR, category);
  await fs.mkdir(outDir, { recursive: true });
  let outName = name;
  const fmt = meta.format;
  if (fmt === 'jpeg' && !/\.jpe?g$/.test(outName)) outName = outName.replace(/\.[a-z]+$/, '.jpg');
  if (fmt === 'png' && !/\.png$/.test(outName)) outName = outName.replace(/\.[a-z]+$/, '.png');
  const out = path.join(outDir, outName);
  const needsRotate = (meta.orientation || 1) !== 1;
  const needsResize = (meta.width || 0) > maxW;
  let note;
  if (buf.length < 100 * 1024 && !needsRotate && !needsResize) {
    await fs.writeFile(out, buf);
    note = 'copied (<100 KB)';
  } else {
    let img = sharp(buf).rotate();
    if (needsResize) img = img.resize({ width: maxW, withoutEnlargement: true });
    if (fmt === 'png') img = img.png({ compressionLevel: 9, palette: false });
    else img = img.jpeg({ quality: 82, mozjpeg: true });
    let data = await img.toBuffer();
    if (data.length >= buf.length && !needsRotate && !needsResize) {
      data = buf;
      note = 'kept original (re-encode larger)';
    } else note = 're-encoded';
    await fs.writeFile(out, data);
  }
  const m2 = await sharp(out).metadata();
  const st = await fs.stat(out);
  return { local: path.relative(ROOT, out), width: m2.width, height: m2.height, bytes: st.size, rawBytes: buf.length, note };
}

async function main() {
  console.log('Scanning live pages and Divi CSS for uploads...');
  const { found, cssCount } = await scanLive();
  const jobs = new Map(); // original url -> category
  for (const u of BRAND) jobs.set(originalUrl(u), 'brand');
  for (const u of PHOTOS) jobs.set(originalUrl(u), 'photos');
  jobs.set(BADGE, 'brand');
  if (existsSync(BLOG_ASSETS)) {
    const blog = JSON.parse(await fs.readFile(BLOG_ASSETS, 'utf8'));
    for (const u of blog) if (!jobs.has(originalUrl(u))) jobs.set(originalUrl(u), 'blog');
  }
  const extras = [];
  for (const [u, cat] of found) {
    if (!jobs.has(u)) { jobs.set(u, cat); extras.push(u); }
  }
  console.log(`Pages scanned: ${PAGES.length}, CSS files scanned: ${cssCount}, extra uploads found: ${extras.length}`);

  const manifest = [];
  const byHash = new Map();
  const failed = [];
  for (const [url, category] of jobs) {
    const dl = await download(url);
    if (!dl) { failed.push(url); continue; }
    const raw = await fs.readFile(dl.file);
    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
    if (byHash.has(sha256)) {
      byHash.get(sha256).aliases.push(url);
      continue;
    }
    const base = localName(dl.fetchedUrl);
    const name = RENAME[base] || base;
    const info = await processOne(dl.file, category, name);
    const entry = { sourceUrl: url, fetchedUrl: dl.fetchedUrl, category, ...info, sha256, aliases: [] };
    byHash.set(sha256, entry);
    manifest.push(entry);
  }
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

  const rows = manifest.map((m) => ({
    file: m.local.replace('src/assets/images/', ''), w: m.width, h: m.height,
    kb: Math.round(m.bytes / 1024), rawKb: Math.round(m.rawBytes / 1024), note: m.note,
  }));
  console.table(rows);
  const total = manifest.reduce((s, m) => s + m.bytes, 0);
  const rawTotal = manifest.reduce((s, m) => s + m.rawBytes, 0);
  console.log(`Images: ${manifest.length} (deduped aliases: ${manifest.reduce((s, m) => s + m.aliases.length, 0)})`);
  console.log(`Total processed: ${(total / 1048576).toFixed(2)} MB (raw ${(rawTotal / 1048576).toFixed(2)} MB)`);
  if (extras.length) console.log('Extras pulled from page/CSS scan:\n  ' + extras.join('\n  '));
  if (failed.length) { console.log('FAILED:\n  ' + failed.join('\n  ')); process.exitCode = 1; }
}

main();
