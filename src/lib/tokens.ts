// Server-side access to the color tokens in src/styles/tokens.css (single source of truth),
// for places CSS variables cannot reach: OG images and the theme-color meta.
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const map = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));

export function token(name: string): string {
  const v = map[name];
  if (!v) throw new Error(`Unknown color token --${name}`);
  return v;
}
