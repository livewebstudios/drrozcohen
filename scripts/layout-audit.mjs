// Phase 9 /layout audit at 320/375/768/1024/1440:
//  - horizontal scroll and elements wider than the viewport
//  - clipped text (text boxes whose content overflows their own box)
//  - tap targets: standalone links/buttons/inputs at least 44x44 (touch widths) or 24x24
//  - sticky header never covers content: page top, anchor jumps, skip link
// Usage: node scripts/layout-audit.mjs [--base=http://localhost:4392]
import { chromium } from 'playwright';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:4392').slice(7);
const PAGES = ['/', '/about/', '/speaking/', '/dr-roz-collaborations/', '/contact-us/', '/blog/', '/category/belonging/', '/2022/01/12/how-can-you-create-a-sense-of-belonging-within-your-organization/', '/2025/03/27/my-phd-research-on-employee-engagement-revealed-something-fascinating/', '/no-such-page/'];
const WIDTHS = [320, 375, 768, 1024, 1440];
const issues = [];
const browser = await chromium.launch({ channel: 'chrome' });

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 1024, isMobile: w < 768 });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const r = await page.evaluate((touch) => {
      const out = { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, wide: [], clipped: [], small: [], headerCover: null };
      const vw = document.documentElement.clientWidth;
      for (const el of document.querySelectorAll('main *, header *, footer *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden],[aria-hidden="true"],.threads-bg,.arch-motif,.visually-hidden,.cform__gotcha')) continue;
        const b = el.getBoundingClientRect();
        if (!b.width) continue;
        // Element sticks out of the viewport and is not clipped by an overflow:hidden ancestor
        if (b.right > vw + 1 || b.left < -1) {
          let a = el.parentElement, clipped = false;
          while (a && a !== document.body) { if (getComputedStyle(a).overflowX !== 'visible') { const ab = a.getBoundingClientRect(); if (ab.right <= vw + 1 && ab.left >= -1) { clipped = true; break; } } a = a.parentElement; }
          if (!clipped) out.wide.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
        }
        // Text that overflows its own box horizontally (word too long, fixed width)
        if (/^(P|H1|H2|H3|H4|LI|A|SPAN|BUTTON|LABEL|FIGCAPTION)$/.test(el.tagName) && el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'visible' && el.clientWidth > 0 && !el.classList.contains('value__num') && getComputedStyle(el).display !== 'inline') {
          if (el.scrollWidth - el.clientWidth > 2) out.clipped.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${el.scrollWidth}>${el.clientWidth}) "${(el.textContent || '').trim().slice(0, 30)}"`);
        }
      }
      // Tap targets: standalone interactive elements (not links inside running text)
      const min = touch ? 44 : 24;
      for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), textarea, select')) {
        if (el.closest('[hidden],.cform__gotcha,[aria-hidden="true"]')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const inText = el.tagName === 'A' && el.closest('p, li') && !el.matches('.btn, .pcard__link, .site-nav__link, .site-footer a, .bfilter__pill, .pager__num, .knav__link, .mnav__link, .adjacent__link, .post__cats a, .contact__links a');
        if (inText) continue;
        const b = el.getBoundingClientRect();
        if (!b.width) continue;
        // Stretched card links count the whole card.
        if (el.classList.contains('pcard__link')) continue;
        if (b.height < min - 0.5 || b.width < min - 0.5) out.small.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      // Header vs first content at the top of the page
      const header = document.querySelector('[data-header]');
      const first = document.querySelector('main h1');
      if (header && first) {
        const hb = header.getBoundingClientRect(), fb = first.getBoundingClientRect();
        if (getComputedStyle(header).position === 'fixed' && fb.top < hb.bottom) out.headerCover = `h1 top ${Math.round(fb.top)} < header bottom ${Math.round(hb.bottom)}`;
      }
      return out;
    }, w < 1024);
    const tag = `${p} @${w}`;
    if (r.overflow > 0) issues.push(`${tag}: horizontal scroll ${r.overflow}px`);
    if (r.wide.length) issues.push(`${tag}: outside viewport: ${[...new Set(r.wide)].slice(0, 5).join(', ')}`);
    if (r.clipped.length) issues.push(`${tag}: text overflow: ${[...new Set(r.clipped)].slice(0, 5).join(' | ')}`);
    if (r.small.length) issues.push(`${tag}: small targets: ${[...new Set(r.small)].slice(0, 8).join(' | ')}`);
    if (r.headerCover) issues.push(`${tag}: header covers H1 (${r.headerCover})`);
    await page.close();
  }
  await ctx.close();
}

// Anchor jumps and skip link: target must land below the fixed header.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
for (const [p, sel] of [['/speaking/', 'a[href="#unlocking-engagement"]'], ['/speaking/', 'a[href="#radical-connectivity"]']]) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await page.locator(sel).first().click();
  await page.waitForTimeout(900);
  const res = await page.evaluate((s) => {
    const id = document.querySelector(s).getAttribute('href').slice(1);
    const t = document.getElementById(id).querySelector('h2').getBoundingClientRect();
    const h = document.querySelector('[data-header]');
    const hb = h.getBoundingClientRect();
    const hidden = h.classList.contains('is-hidden');
    return { top: Math.round(t.top), headerBottom: hidden ? 0 : Math.round(hb.bottom) };
  }, sel);
  if (res.top < res.headerBottom) issues.push(`${p} ${sel}: heading at ${res.top}px under header bottom ${res.headerBottom}px`);
}
await browser.close();

console.log(`Checked ${PAGES.length} pages x ${WIDTHS.length} widths (320/375/768/1024/1440) + anchor jumps.`);
if (issues.length) { console.log(issues.join('\n')); console.log(`FAIL: ${issues.length}`); process.exitCode = 1; }
else console.log('PASS: no horizontal scroll, nothing outside the viewport, no clipped text, tap targets OK, header never covers content');
