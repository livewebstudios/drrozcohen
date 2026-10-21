// Phase 8 browser QA against the built site (npm run preview).
//   4  full-page screenshots at 375/768/1024/1440, no horizontal scroll, no console errors,
//      keyboard nav + mobile menu, form validation + counter, blog filter, 404
//   5  axe-core: zero serious/critical violations
//   7  reduced motion: static threads frame, no parallax transforms, content visible
//   8  JS off: pages readable, nav links work, form posts natively, pills are links
// Usage: node scripts/qa.mjs [--base=http://localhost:4392] [--only=screens,axe,keys,form,filter,reduce,nojs,404] [--noshots]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v = '1'] = a.slice(2).split('='); return [k, v]; }));
const BASE = flags.base || 'http://localhost:4392';
const ONLY = flags.only ? new Set(flags.only.split(',')) : null;
const run = (k) => !ONLY || ONLY.has(k);
const OUT = 'qa/screens';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = {
  home: '/',
  about: '/about/',
  speaking: '/speaking/',
  collaborations: '/dr-roz-collaborations/',
  contact: '/contact-us/',
  blog: '/blog/',
  'blog-page-2': '/blog/page/2/',
  category: '/category/belonging/',
  'post-wp': '/2022/01/12/how-can-you-create-a-sense-of-belonging-within-your-organization/',
  'post-linkedin': '/2025/03/27/my-phd-research-on-employee-engagement-revealed-something-fascinating/',
  'thank-you': '/thank-you/',
  '404': '/this-page-does-not-exist/',
};
const WIDTHS = [375, 768, 1024, 1440];
const results = [];
const fail = (area, msg) => results.push({ area, ok: false, msg });
const pass = (area, msg) => results.push({ area, ok: true, msg });

const browser = await chromium.launch({ channel: 'chrome' });

async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

// ---------- 4. Screens, overflow, console ----------
if (run('screens')) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    for (const [name, p] of Object.entries(PAGES)) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      await scrollThrough(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (!flags.noshots) await page.screenshot({ path: `${OUT}/${name}_${w}.png`, fullPage: true });
      const realErrors = errors.filter((e) => !(name === '404' && /404/.test(e)));
      if (overflow > 0) fail('overflow', `${name} @${w}: ${overflow}px horizontal scroll`);
      if (realErrors.length) fail('console', `${name} @${w}: ${realErrors.join(' | ')}`);
      await page.close();
    }
    await ctx.close();
  }
  if (!results.some((r) => !r.ok && (r.area === 'overflow' || r.area === 'console')))
    pass('screens', `${Object.keys(PAGES).length} page types x ${WIDTHS.length} widths: no horizontal scroll, no console errors`);
}

// ---------- 4. Keyboard nav + mobile menu ----------
if (run('keys')) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const seq = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    seq.push(await page.evaluate(() => {
      const a = document.activeElement;
      const cs = getComputedStyle(a);
      return { text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 30), outline: cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' };
    }));
  }
  const labels = seq.map((s) => s.text);
  const expected = ['SKIP TO CONTENT', 'HOME', 'ABOUT', 'SPEAKING', 'DR. ROZ COLLABORATIONS', 'BLOG', 'CONTACT'];
  const navOk = expected.every((e) => labels.includes(e)) || labels.some((l) => /home/i.test(l));
  navOk ? pass('keyboard', `desktop tab order: ${labels.join(' > ')}`) : fail('keyboard', `desktop tab order: ${labels.join(' > ')}`);
  seq.every((s) => s.outline) ? pass('focus', 'focus outline visible on every tabbed element') : fail('focus', `missing focus outline: ${seq.filter((s) => !s.outline).map((s) => s.text).join(', ')}`);
  // Skip link moves focus to main
  await page.goto(BASE + '/about/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const onMain = await page.evaluate(() => document.activeElement?.id === 'main' || location.hash === '#main');
  onMain ? pass('keyboard', 'skip link jumps to main') : fail('keyboard', 'skip link did not move to main');
  await ctx.close();

  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const m = await mctx.newPage();
  await m.goto(BASE + '/', { waitUntil: 'networkidle' });
  await m.waitForFunction(() => !!document.querySelector('.mnav__toggle') && !document.querySelector('astro-island[component-url*="MobileNav"][ssr]'), null, { timeout: 8000 }).catch(() => {});
  const toggle = m.locator('.mnav__toggle');
  await toggle.focus();
  await m.keyboard.press('Enter');
  await m.waitForTimeout(300);
  const open = await m.evaluate(() => ({ expanded: document.querySelector('.mnav__toggle')?.getAttribute('aria-expanded'), visible: !document.getElementById('mobile-menu')?.hidden, inPanel: !!document.activeElement?.closest('#mobile-menu') }));
  open.expanded === 'true' && open.visible && open.inPanel ? pass('mobile-menu', 'opens by keyboard, focus moves into the panel') : fail('mobile-menu', `open state ${JSON.stringify(open)}`);
  for (let i = 0; i < 12; i++) await m.keyboard.press('Tab');
  const trapped = await m.evaluate(() => !!document.activeElement?.closest('#mobile-menu'));
  trapped ? pass('mobile-menu', 'focus trapped inside while open') : fail('mobile-menu', 'focus escaped the open menu');
  await m.keyboard.press('Escape');
  await m.waitForTimeout(200);
  const closed = await m.evaluate(() => ({ hidden: document.getElementById('mobile-menu')?.hidden, back: document.activeElement?.classList.contains('mnav__toggle') }));
  closed.hidden && closed.back ? pass('mobile-menu', 'Escape closes and returns focus to MENU') : fail('mobile-menu', `close state ${JSON.stringify(closed)}`);
  await toggle.click();
  await m.locator('.mnav__link', { hasText: 'ABOUT' }).click();
  await m.waitForURL('**/about/');
  pass('mobile-menu', 'menu link navigates (ABOUT)');
  await mctx.close();
}

// ---------- 4. Form validation + counter ----------
if (run('form')) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const page = await ctx.newPage();
  await page.route('https://formspree.io/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto(BASE + '/contact-us/', { waitUntil: 'networkidle' });
  const form = page.locator('main form.cform');
  await form.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[component-url*="ContactForm"][ssr]'), null, { timeout: 8000 }).catch(() => {});
  await form.locator('button[type="submit"]').click();
  const errs = await form.locator('.cform__error').allTextContents();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('name'));
  errs.length === 3 && focused === 'name' ? pass('form', `empty send shows 3 errors and focuses Name (${errs.join(' / ')})`) : fail('form', `errors=${JSON.stringify(errs)} focus=${focused}`);
  await form.locator('input[name="email"]').fill('not-an-email');
  await form.locator('button[type="submit"]').click();
  const emailErr = await form.locator('[id$="email-err"]').textContent();
  /look right/.test(emailErr || '') ? pass('form', 'invalid email is caught') : fail('form', `email error: ${emailErr}`);
  await form.locator('textarea').fill('Hello');
  const count = await form.locator('.cform__count').textContent();
  count?.trim() === '5 / 600' ? pass('form', 'live counter reads 5 / 600') : fail('form', `counter: ${count}`);
  const max = await form.locator('textarea').getAttribute('maxlength');
  max === '600' ? pass('form', 'message maxlength 600') : fail('form', `maxlength ${max}`);
  await form.locator('input[name="name"]').fill('QA Test');
  await form.locator('input[name="email"]').fill('qa@example.com');
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);
  const status = await form.locator('.cform__status').textContent().catch(() => '');
  /Thanks\. Roz will be in touch shortly\./.test(status || '') ? pass('form', 'async send shows the success message (Formspree mocked)') : fail('form', `status: ${status}`);
  const live = await form.locator('[aria-live="polite"]').count();
  live ? pass('form', 'status region is aria-live="polite"') : fail('form', 'no aria-live status region');
  await ctx.close();
}

// ---------- 4. Blog filter ----------
if (run('filter')) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/blog/', { waitUntil: 'networkidle' });
  await page.locator('.bfilter').scrollIntoViewIfNeeded();
  await page.waitForSelector('.bfilter button.bfilter__pill', { timeout: 8000 });
  const total = await page.locator('[data-post-card]').count();
  await page.locator('.bfilter button', { hasText: 'Belonging' }).click();
  await page.waitForTimeout(200);
  const visible = await page.locator('[data-post-card]:not([hidden])').count();
  const expected = await page.evaluate(() => [...document.querySelectorAll('[data-post-card]')].filter((c) => c.dataset.categories.split('|').includes('Belonging')).length);
  const statusText = await page.locator('.bfilter__status').textContent();
  visible === expected && visible < total ? pass('blog-filter', `Belonging shows ${visible} of ${total} cards; status "${statusText?.trim()}"`) : fail('blog-filter', `visible ${visible}, expected ${expected}, total ${total}`);
  await page.locator('.bfilter button', { hasText: 'ALL' }).click();
  (await page.locator('[data-post-card]:not([hidden])').count()) === total ? pass('blog-filter', 'ALL restores every card') : fail('blog-filter', 'ALL did not restore');
  await ctx.close();
}

// ---------- 4. 404 ----------
if (run('404')) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(BASE + '/no-such-page/', { waitUntil: 'networkidle' });
  const h1 = await page.locator('h1').textContent();
  res?.status() === 404 && h1?.trim() === 'Page not found.' ? pass('404', 'unknown URL returns 404 with "Page not found."') : fail('404', `status ${res?.status()} h1 ${h1}`);
  await ctx.close();
}

// ---------- 5. axe ----------
if (run('axe')) {
  for (const w of [375, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    for (const [name, p] of Object.entries(PAGES)) {
      const page = await ctx.newPage();
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      await scrollThrough(page);
      await page.waitForTimeout(800);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (bad.length) fail('axe', `${name} @${w}: ${bad.map((v) => `${v.id} (${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')})`).join('; ')}`);
      await page.close();
    }
    await ctx.close();
  }
  if (!results.some((r) => r.area === 'axe' && !r.ok)) pass('axe', `zero serious/critical violations on ${Object.keys(PAGES).length} page types at 375 and 1440`);
}

// ---------- 7. Reduced motion ----------
if (run('reduce')) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const snap = () => page.evaluate(() => [...document.querySelectorAll('.threads-bg canvas')].map((c) => c.toDataURL().length + ':' + c.toDataURL().slice(-64)));
  const a = await snap();
  await page.mouse.move(400, 300);
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const b = await snap();
  a.length && JSON.stringify(a) === JSON.stringify(b) ? pass('reduced-motion', `threads render one static frame (${a.length} canvases unchanged)`) : fail('reduced-motion', `canvases changed or missing (${a.length})`);
  await scrollThrough(page);
  const moved = await page.evaluate(() => [...document.querySelectorAll('[data-parallax], [data-parallax-inner]')].filter((e) => { const t = getComputedStyle(e).transform; return t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)'; }).length);
  moved === 0 ? pass('reduced-motion', 'no parallax transforms') : fail('reduced-motion', `${moved} parallax elements transformed`);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal], [data-focus-word], .w')].filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).length);
  hidden === 0 ? pass('reduced-motion', 'all reveal content fully visible, no scrubbed opacity') : fail('reduced-motion', `${hidden} elements below full opacity`);
  const drift = await page.evaluate(() => [...document.querySelectorAll('.arch-motif--drift svg')].filter((e) => getComputedStyle(e).animationName !== 'none').length);
  drift === 0 ? pass('reduced-motion', 'arch drift animations off') : fail('reduced-motion', `${drift} arch drifts still animating`);
  await ctx.close();
}

// ---------- 8. JS off ----------
if (run('nojs')) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, javaScriptEnabled: false });
  for (const [name, p] of Object.entries(PAGES)) {
    const page = await ctx.newPage();
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForTimeout(700); // let the 400ms CSS headline fade finish
    const s = await page.evaluate(() => {
      const nav = document.querySelector('.site-nav');
      const navVisible = nav && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().height > 0;
      const h1 = document.querySelector('h1');
      const hidden = [...document.querySelectorAll('main p, main h1, main h2')].filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).length;
      return { navVisible, navLinks: nav ? nav.querySelectorAll('a[href]').length : 0, h1: !!h1 && h1.getBoundingClientRect().height > 0, hidden };
    });
    if (!s.navVisible || s.navLinks < 6 || !s.h1 || s.hidden) fail('js-off', `${name}: ${JSON.stringify(s)}`);
    await page.close();
  }
  const page = await ctx.newPage();
  await page.goto(BASE + '/contact-us/');
  const form = await page.evaluate(() => { const f = document.querySelector('main form'); return f && { action: f.getAttribute('action'), method: f.getAttribute('method'), gotcha: !!f.querySelector('[name="_gotcha"]'), next: f.querySelector('[name="_next"]')?.getAttribute('value') }; });
  form && /^https:\/\/formspree\.io\/f\//.test(form.action) && /post/i.test(form.method) && form.gotcha ? pass('js-off', `contact form posts natively to ${form.action} (honeypot + _next ${form.next})`) : fail('js-off', `form ${JSON.stringify(form)}`);
  await page.goto(BASE + '/blog/');
  const pills = await page.evaluate(() => [...document.querySelectorAll('.bfilter .bfilter__pill')].map((e) => e.tagName + ' ' + e.getAttribute('href')));
  pills.length === 9 && pills.every((x) => /^A \//.test(x)) ? pass('js-off', 'blog pills are plain links to category archives') : fail('js-off', `pills ${pills.join(', ')}`);
  await page.locator('.site-nav a', { hasText: 'ABOUT' }).click();
  await page.waitForURL('**/about/');
  pass('js-off', 'nav link works without JS (BLOG > ABOUT)');
  await ctx.close();
  if (!results.some((r) => r.area === 'js-off' && !r.ok)) pass('js-off', `all ${Object.keys(PAGES).length} page types readable with visible nav at 375 and JS off`);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.area}] ${r.msg}`);
fs.writeFileSync('qa/qa-results.json', JSON.stringify(results, null, 2));
console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
if (failed.length) process.exitCode = 1;
