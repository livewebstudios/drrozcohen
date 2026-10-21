// Shared helpers for the asset pipeline and the blog importer.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RAW_DIR = path.join(ROOT, 'images', 'raw');
export const OUT_DIR = path.join(ROOT, 'src', 'assets', 'images');
export const MANIFEST = path.join(ROOT, 'scripts', 'assets-manifest.json');
export const BLOG_ASSETS = path.join(ROOT, 'scripts', 'blog-assets.json');

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Strip WordPress size suffixes (-480x720, -scaled) to get the original upload URL. */
export function originalUrl(url) {
  return url.replace(/-\d+x\d+(?=\.[a-z]+$)/i, '').replace(/-scaled(?=\.[a-z]+$)/i, '');
}

/** Candidate URLs to try, best first: non-suffixed original, then -scaled. */
export function candidates(url) {
  const clean = url.split('?')[0];
  if (!/\/wp-content\/uploads\//.test(clean)) return [clean];
  const orig = originalUrl(clean);
  const scaled = orig.replace(/(\.[a-z]+)$/i, '-scaled$1');
  return [...new Set([orig, scaled, clean])];
}

/** Stable local file name for a source URL (no size suffixes, lowercase, safe chars). */
export function localName(url) {
  const clean = originalUrl(url.split('?')[0]);
  let base = decodeURIComponent(clean.split('/').pop() || 'image');
  if (/cdn\.b12\.io/.test(clean)) {
    // b12 names look like <uuid>-png-regular_image.png; keep the uuid head only.
    base = base.replace(/-(png|jpe?g)-regular_image/i, '');
  }
  return base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-');
}

export async function fetchOk(url, opts = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...(opts.headers || {}) }, redirect: 'follow' });
  return res;
}
