// Dev helper: side-by-side contact sheet of full-page screenshots for one width.
// Usage: node scripts/contact-sheet.mjs <width> <colWidth> <maxHeight> <out> page1 page2 ...
import sharp from 'sharp';
const [w, cw = '300', mh = '2600', out, ...pages] = process.argv.slice(2);
const cols = [];
for (const p of pages) {
  const file = `qa/screens/${p}_${w}.png`;
  const scaled = await sharp(file).resize({ width: +cw }).toBuffer({ resolveWithObject: true });
  const h = Math.min(scaled.info.height, +mh);
  cols.push(await sharp(scaled.data).extract({ left: 0, top: 0, width: +cw, height: h }).toBuffer());
}
const H = Math.max(...(await Promise.all(cols.map(async (c) => (await sharp(c).metadata()).height))));
await sharp({ create: { width: cols.length * (+cw + 12), height: H, channels: 3, background: '#777' } })
  .composite(cols.map((c, i) => ({ input: c, left: i * (+cw + 12), top: 0 })))
  .jpeg({ quality: 78 })
  .toFile(out);
console.log(out);
