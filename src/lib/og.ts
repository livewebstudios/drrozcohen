// Build-time Open Graph images (1200x630): plum band, traced arch motif, title in Montserrat,
// and a real photo inside the arch on the right. Satori sets the type (as paths), sharp
// composites the arch-masked photo.
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { token } from './tokens';

const ROOT = process.cwd();
const font = (f: string) => fs.readFileSync(path.join(ROOT, 'node_modules', f));
const FONTS = [
  { name: 'Montserrat', data: font('@fontsource/montserrat/files/montserrat-latin-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
  { name: 'Montserrat', data: font('@fontsource/montserrat/files/montserrat-latin-600-normal.woff'), weight: 600 as const, style: 'normal' as const },
];

const W = 1200;
const H = 630;
const PHOTO = { x: 772, y: 70, w: 368, h: 490 };

// Arch motif paths (same geometry as ArchMotif.astro), scaled into the background.
const MOTIF = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g fill="none" stroke="${token('orchid-soft')}" stroke-opacity="0.28" stroke-width="1.5" transform="translate(-120 360) scale(1.9)">
    <path d="M2 168C40 95 110 30 200 21C260 15 315 45 350 73C330 67 305 61 270 61C180 62 120 110 86 168Z"/>
    <path d="M194 12C230 4 260 1 290 2C395 2 470 80 522 168H442C370 45 280 8 194 12Z"/>
    <path d="M141 102V168M204 70V168M267 61V168"/>
  </g>
</svg>`;

const archMask = (w: number, h: number) => {
  const r = w / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="M0 ${r}A${r} ${r} 0 0 1 ${w} ${r}V${h - 10}Q${w} ${h} ${w - 10} ${h}H10Q0 ${h} 0 ${h - 10}Z" fill="${token('paper')}"/></svg>`,
  );
};

function titleSize(t: string) {
  const n = t.length;
  if (n <= 34) return 64;
  if (n <= 60) return 54;
  if (n <= 95) return 44;
  if (n <= 130) return 36;
  return 30;
}

export async function renderOg(opts: { title: string; eyebrow: string; photo: string; position?: string }) {
  const { title, eyebrow, photo } = opts;
  const size = titleSize(title);
  type SatoriNode = Parameters<typeof satori>[0];
  const svg = await satori(
    ({
      type: 'div',
      props: {
        style: {
          width: W,
          height: H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 0 64px 72px',
          backgroundColor: token('plum-deep'),
          fontFamily: 'Montserrat',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', fontSize: 22, fontWeight: 600, letterSpacing: 4, color: token('orchid-soft') },
              children: eyebrow,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: 640,
                fontSize: size,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: -1,
                color: token('paper'),
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', fontSize: 22, fontWeight: 600, letterSpacing: 2, color: token('on-dark-soft') },
              children: 'drrozcohen.com',
            },
          },
        ],
      },
    } as unknown) as SatoriNode,
    { width: W, height: H, fonts: FONTS },
  );
  const photoBuf = await sharp(photo)
    .rotate()
    .resize(PHOTO.w, PHOTO.h, { fit: 'cover', position: opts.position || 'attention' })
    .composite([{ input: archMask(PHOTO.w, PHOTO.h), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const R = PHOTO.w / 2 + 14;
  const cy = 14 + PHOTO.w / 2;
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO.w + 28}" height="${PHOTO.h + 28}"><path d="M0 ${cy + 120}V${cy}A${R} ${R} 0 0 1 ${PHOTO.w + 28} ${cy}V${cy + 120}" fill="none" stroke="${token('orchid')}" stroke-width="1.5"/></svg>`,
  );
  return sharp(Buffer.from(svg))
    .composite([
      { input: Buffer.from(MOTIF), left: 0, top: 0 },
      { input: frame, left: PHOTO.x - 14, top: PHOTO.y - 14 },
      { input: photoBuf, left: PHOTO.x, top: PHOTO.y },
    ])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

/** Resolve the featuredImage path written in a post's frontmatter to a file on disk. */
export function featuredFile(mdPath: string) {
  const raw = fs.readFileSync(path.join(ROOT, mdPath), 'utf8');
  const m = raw.match(/^featuredImage:\s*"?([^"\n]+)"?\s*$/m);
  return m ? path.resolve(path.dirname(path.join(ROOT, mdPath)), m[1]) : null;
}

export const photo = (name: string) => path.join(ROOT, 'src/assets/images/photos', name);
