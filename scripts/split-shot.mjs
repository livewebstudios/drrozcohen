// Dev helper: split a tall screenshot into viewable chunks. Usage: node scripts/split-shot.mjs <png> [chunkHeight] [outWidth]
import sharp from 'sharp';
const [file, ch = '1800', ow = '1000'] = process.argv.slice(2);
const m = await sharp(file).metadata();
const n = Math.ceil(m.height / +ch);
for (let i = 0; i < n; i++) {
  const top = i * +ch, height = Math.min(+ch, m.height - top);
  const out = file.replace(/\.png$/, `_part${i}.jpg`);
  await sharp(file).extract({ left: 0, top, width: m.width, height }).resize({ width: Math.min(+ow, m.width) }).jpeg({ quality: 80 }).toFile(out);
  console.log(out);
}
