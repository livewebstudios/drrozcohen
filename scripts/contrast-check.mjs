// Phase 8.5: WCAG 2.2 AA contrast for every text/background pair the design uses.
// Reads token values from src/styles/tokens.css. Usage: node scripts/contrast-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/assets.mjs';

const css = fs.readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8');
const tok = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Plum overlay (rgba(90,0,67,.82)) over the brightest pixel of the blog hero photo (white).
const overlayOnWhite = '#' + [90, 0, 67].map((c) => Math.round(c * 0.82 + 255 * 0.18).toString(16).padStart(2, '0')).join('');

// [foreground, background, minimum, where]
const PAIRS = [
  ['ink', 'paper', 4.5, 'body text'],
  ['ink', 'blush', 4.5, 'body text on tinted sections'],
  ['ink-soft', 'paper', 4.5, 'secondary text, excerpts'],
  ['ink-soft', 'blush', 4.5, 'author role, secondary text on blush'],
  ['plum', 'paper', 4.5, 'headings, links, buttons outline'],
  ['plum', 'blush', 4.5, 'headings on blush'],
  ['plum-ink', 'blush-deep', 4.5, 'category chips, success message'],
  ['slate', 'paper', 4.5, 'eyebrows, meta text'],
  ['slate', 'blush', 4.5, 'eyebrows on blush'],
  ['paper', 'plum', 4.5, 'button text, testimonial card'],
  ['paper', 'plum-deep', 4.5, 'text on dark bands, hover buttons'],
  ['on-dark-soft', 'plum-deep', 4.5, 'eyebrows on dark bands'],
  ['orchid-soft', 'plum-deep', 4.5, 'links and accents on dark'],
  ['plum', 'paper', 4.5, 'light button text (white button on dark)'],
  ['on-dark', 'charcoal', 4.5, 'footer text'],
  ['on-dark-soft', 'charcoal', 4.5, 'footer headings, copyright'],
  ['orchid-soft', 'charcoal', 4.5, 'footer link hover'],
  ['orchid', 'paper', 3, 'large or decorative only: greeting script, numerals, quote mark'],
  ['orchid-soft', 'plum-deep', 3, 'RBG attribution (large script)'],
  ['error', 'paper', 4.5, 'form errors'],
  ['error-ink', 'error-bg', 4.5, 'form error banner'],
  ['paper', '#' + overlayOnWhite.slice(1), 4.5, 'blog hero text over plum overlay (worst case: white photo)'],
  ['on-dark-soft', '#' + overlayOnWhite.slice(1), 4.5, 'blog hero eyebrow link over overlay'],
  // Interactive states
  ['paper', 'plum-deep', 4.5, 'solid button hover, skip link'],
  ['plum-deep', 'blush', 4.5, 'light button hover on dark bands'],
  ['paper', 'plum', 4.5, 'outline button hover, active pill, current page number'],
  ['plum', 'paper', 4.5, 'nav link hover/current, pill hover, pager link'],
  ['slate', 'paper', 4.5, 'disabled pager label (struck through)'],
  ['on-dark', 'plum-deep', 4.5, 'mobile menu links'],
  ['orchid-soft', 'plum-deep', 4.5, 'mobile menu current link and numbers'],
  ['plum-ink', 'blush-deep', 4.5, 'category chip'],
  ['paper', 'plum', 4.5, 'category chip hover'],
  ['plum', 'paper', 4.5, 'form counter near limit'],
  // Non-text (WCAG 1.4.11, 3:1)
  ['orchid', 'paper', 3, 'focus ring on light backgrounds'],
  ['orchid', 'blush', 3, 'focus ring on blush'],
  ['orchid-soft', 'plum-deep', 3, 'focus ring on dark bands and menu'],
  ['orchid-soft', 'charcoal', 3, 'focus ring in the footer'],
  ['field-border', 'paper', 3, 'form field borders'],
  ['plum', 'paper', 3, 'focused field border'],
  ['error', 'paper', 3, 'invalid field border'],
  ['plum', 'paper', 3, 'session arch bullets, list markers'],
];
let fail = 0;
const rows = PAIRS.map(([fg, bg, min, where]) => {
  const f = fg.startsWith('#') ? fg : tok[fg];
  const b = bg.startsWith('#') ? bg : tok[bg];
  const r = ratio(f, b);
  const ok = r >= min;
  if (!ok) fail++;
  return { fg, bg, ratio: +r.toFixed(2), min, ok: ok ? 'pass' : 'FAIL', where };
});
console.table(rows);
console.log(fail ? `FAIL: ${fail} pairs` : `PASS: ${rows.length} pairs`);
if (fail) process.exitCode = 1;
