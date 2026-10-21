// Split the three combined logo strips into individual logos.
// The strips are flat RGB on white, so gaps are runs of near-white columns. Each logo is
// trimmed, its white background keyed to transparent, and written to
// src/assets/images/brand/logos/<strip>-<n>.png. Usage: node scripts/split-logos.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { OUT_DIR } from './lib/assets.mjs';

const STRIPS = ['featured-in-logos', 'trusted-by-logos', 'past-talks-logos'];
const WHITE = 242; // channel value treated as background
const MIN_GAP = 20; // px of blank columns that separate two logos
const MIN_W = 14; // segments narrower than this are dividers, dropped

async function split(name) {
  const src = path.join(OUT_DIR, 'brand', `${name}.png`);
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const blankCol = (x) => {
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * channels;
      if (data[i] < WHITE || data[i + 1] < WHITE || data[i + 2] < WHITE) return false;
    }
    return true;
  };
  const segs = [];
  let start = -1, gap = 0;
  for (let x = 0; x <= width; x++) {
    const blank = x === width || blankCol(x);
    if (!blank) { if (start < 0) start = x; gap = 0; continue; }
    if (start >= 0) {
      gap++;
      if (gap >= MIN_GAP || x === width) { segs.push([start, x - gap + 1]); start = -1; gap = 0; }
    }
  }
  const kept = segs.filter(([a, b]) => b - a >= MIN_W);
  const outDir = path.join(OUT_DIR, 'brand', 'logos');
  await fs.mkdir(outDir, { recursive: true });
  const results = [];
  for (const [i, [a, b]] of kept.entries()) {
    const piece = await sharp(src).removeAlpha().extract({ left: a, top: 0, width: b - a, height }).raw().toBuffer();
    // Key white to transparent with a soft edge.
    const w = b - a;
    const rgba = Buffer.alloc(w * height * 4);
    for (let p = 0; p < w * height; p++) {
      const r = piece[p * 3], g = piece[p * 3 + 1], bl = piece[p * 3 + 2];
      const lo = Math.min(r, g, bl);
      const alpha = lo >= 250 ? 0 : lo <= 215 ? 255 : Math.round(((250 - lo) / 35) * 255);
      rgba.set([r, g, bl, alpha], p * 4);
    }
    const file = path.join(outDir, `${name.replace('-logos', '')}-${i + 1}.png`);
    await sharp(rgba, { raw: { width: w, height, channels: 4 } }).trim({ threshold: 1 }).png({ compressionLevel: 9 }).toFile(file);
    const m = await sharp(file).metadata();
    results.push({ file: path.basename(file), w: m.width, h: m.height });
  }
  return results;
}

for (const s of STRIPS) {
  const r = await split(s);
  console.log(`${s}: ${r.length} logos`);
  console.table(r);
}
