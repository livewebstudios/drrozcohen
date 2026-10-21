// /animate verification: entrance, scroll reveals, parallax, threads, draw, header, filter.
// Usage: node scripts/motion-check.mjs [--base=http://localhost:4392]
import { chromium } from 'playwright';
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:4392').slice(7);
const out = [];
const ok = (c, m) => out.push(`${c ? 'PASS' : 'FAIL'}  ${m}`);
const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Blog: featured card is on screen when motion loads, must never be hidden.
await page.goto(BASE + '/blog/', { waitUntil: 'networkidle' });
const samples = [];
for (let i = 0; i < 12; i++) { samples.push(await page.evaluate(() => +getComputedStyle(document.querySelector('[data-post-card]')).opacity)); await page.waitForTimeout(150); }
ok(Math.min(...samples) > 0.99, `above-fold card never flashes out while motion loads (min opacity ${Math.min(...samples)})`);
ok(await page.evaluate(() => !!window.LWS?.observe), 'window.LWS.observe is available');

// Home
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const h1 = await page.evaluate(() => +getComputedStyle(document.querySelector('h1')).opacity);
ok(h1 > 0.99, 'hero headline faded in (400ms CSS)');
const below = await page.evaluate(() => { const el = document.querySelector('.values [data-reveal]'); return +getComputedStyle(el).opacity; });
ok(below < 0.5, `below-fold value card waits hidden for its trigger (opacity ${below})`);
const p0 = await page.evaluate(() => getComputedStyle(document.querySelector('.hero__portrait')).transform);
const snap = () => page.evaluate(() => document.querySelector('.threads-bg canvas').toDataURL().slice(-200));
const t0 = await snap();
await page.waitForTimeout(700);
ok(t0 !== (await snap()), 'threads animate');
await page.mouse.wheel(0, 400);
await page.waitForTimeout(600);
const p1 = await page.evaluate(() => getComputedStyle(document.querySelector('.hero__portrait')).transform);
ok(p0 !== p1, `hero portrait parallax moves (${p1.slice(0, 40)})`);
const hdr = await page.evaluate(() => document.querySelector('[data-header]').className);
ok(/is-solid/.test(hdr) && /is-hidden/.test(hdr), `header solid and hidden on scroll down (${hdr})`);
await page.mouse.wheel(0, -150);
await page.waitForTimeout(500);
ok(!(await page.evaluate(() => document.querySelector('[data-header]').classList.contains('is-hidden'))), 'header returns on scroll up');
// Scroll through everything
const H = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < H; y += 300) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(60); }
await page.waitForTimeout(1200);
const after = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((e) => +getComputedStyle(e).opacity < 0.99).length);
ok(after === 0, `every reveal completes after scrolling (${after} left)`);
const drawn = await page.evaluate(() => [...document.querySelectorAll('.arch-divider [data-draw]')].map((p) => +getComputedStyle(p).strokeDashoffset.replace('px', '') || 0));
ok(drawn.every((d) => d < 0.01), `divider arch drew itself (${drawn.join(',')})`);
const words = await page.evaluate(() => document.querySelectorAll('[data-word-scrub] .w').length);
ok(words > 10, `quote split into ${words} scrubbed words`);

// Filter shows cards that were hidden at init; they must end visible.
await page.goto(BASE + '/blog/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.bfilter button', { hasText: 'Engagement' }).click();
await page.waitForTimeout(300);
for (let y = 0; y < 4000; y += 300) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(60); }
await page.waitForTimeout(1000);
const stuck = await page.evaluate(() => [...document.querySelectorAll('[data-post-card]:not([hidden])')].filter((e) => +getComputedStyle(e).opacity < 0.99).length);
ok(stuck === 0, `filtered cards all visible (${stuck} stuck)`);
ok(!errors.length, `no page errors ${errors.join(' | ')}`);
await b.close();
console.log(out.join('\n'));
if (out.some((l) => l.startsWith('FAIL'))) process.exitCode = 1;
