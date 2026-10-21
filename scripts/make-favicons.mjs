// Favicons from the live favicon source (cropped-dr-roz-logo-footer.png). Usage: node scripts/make-favicons.mjs
import sharp from 'sharp';
import path from 'node:path';
import { ROOT, OUT_DIR } from './lib/assets.mjs';

const src = path.join(OUT_DIR, 'brand', 'cropped-dr-roz-logo-footer.png');
const pub = path.join(ROOT, 'public');
const out = [
  ['favicon-32x32.png', 32, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, true],
];
for (const [name, size, flat] of out) {
  let img = sharp(src).resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: flat ? 1 : 0 } });
  if (flat) img = img.flatten({ background: '#ffffff' });
  await img.png({ compressionLevel: 9 }).toFile(path.join(pub, name));
  console.log(name);
}
