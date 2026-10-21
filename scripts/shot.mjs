// Dev helper: full-page screenshot after scrolling through (so reveals have fired).
// Usage: node scripts/shot.mjs <path> <width> [outfile] [--base=http://localhost:4391] [--reduce]
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [p = '/', w = '1440', out] = args.filter((a) => !a.startsWith('--'));
const base = flags.base || 'http://localhost:4391';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: +w, height: 900 }, reducedMotion: flags.reduce !== undefined ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + p, { waitUntil: 'networkidle' });
const h = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < h; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(120); }
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(700);
const file = out || `qa/screens/dev_${p.replace(/\W+/g, '_') || 'home'}_${w}.png`;
await page.screenshot({ path: file, fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(file, 'height', h, 'overflowX', overflow, errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
await browser.close();
