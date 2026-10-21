import { useEffect, useRef } from 'react';

/**
 * "Living Threads": fine threads drifting on a 3D simplex-noise flow field. Where two
 * threads pass within ~14px a short brighter "braid" appears and fades over 1.2s.
 * Canvas 2D, DPR capped at 1.5, paused offscreen and in hidden tabs, 30fps on low-power
 * devices, one static frame under prefers-reduced-motion. Decorative: aria-hidden.
 */
type Props = {
  variant?: 'light' | 'dark';
  /** Multiplier on the thread count (1 = 48 to 64 desktop, 22 to 30 mobile). */
  density?: number;
  /** Stable composition per page. */
  seed?: number;
};

// ---------- Seeded RNG + compact 3D simplex noise (Gustavson) ----------
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const G3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];

function makeNoise(rand: () => number) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  const pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    pm12[i] = perm[i] % 12;
  }
  const F3 = 1 / 3;
  const G = 1 / 6;
  return (x: number, y: number, z: number) => {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0];
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1];
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1];
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1];
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1];
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0];
    const x1 = x0 - i1 + G, y1 = y0 - j1 + G, z1 = z0 - k1 + G;
    const x2 = x0 - i2 + 2 * G, y2 = y0 - j2 + 2 * G, z2 = z0 - k2 + 2 * G;
    const x3 = x0 - 1 + 3 * G, y3 = y0 - 1 + 3 * G, z3 = z0 - 1 + 3 * G;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const corner = (gi: number, cx: number, cy: number, cz: number) => {
      let tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt < 0) return 0;
      tt *= tt;
      return tt * tt * (G3[gi * 3] * cx + G3[gi * 3 + 1] * cy + G3[gi * 3 + 2] * cz);
    };
    const n0 = corner(pm12[ii + perm[jj + perm[kk]]], x0, y0, z0);
    const n1 = corner(pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1);
    const n2 = corner(pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2);
    const n3 = corner(pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3);
    return 32 * (n0 + n1 + n2 + n3); // -1..1
  };
}

// ---------- Palette (read from the CSS color tokens at runtime) ----------
const ALPHA = { light: [0.06, 0.22], dark: [0.05, 0.18] } as const;
const TONES = { light: ['--plum', '--orchid', '--slate'], dark: ['--orchid', '--paper'] } as const;
function palette(variant: 'light' | 'dark') {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (v: string) => {
    const h = cs.getPropertyValue(v).trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  };
  return { colors: TONES[variant].map(rgb), alpha: ALPHA[variant] };
}

const POINTS = 60;
const STEP = 7; // px travelled between stored trail points
const BRAID_DIST = 14;
const BRAID_LIFE = 1200; // ms
const POINTER_R = 180;

type Thread = { xs: Float32Array; ys: Float32Array; head: number; x: number; y: number; travel: number; color: string; alpha: number; speed: number; width: number };
type Braid = { a: number; ai: number; b: number; bi: number; born: number };

export default function ThreadsBackground({ variant = 'light', density = 1, seed = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    // astro-island is display: contents, so measure the positioned wrapper instead.
    const host = (canvas?.closest('.threads-bg') as HTMLElement | null) ?? canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const rand = mulberry32(seed * 9973 + 17);
    const noise = makeNoise(rand);
    const pal = palette(variant);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let lowPower = (navigator.hardwareConcurrency || 8) <= 4;
    type BatteryLike = { level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    nav.getBattery?.().then((b) => {
      const check = () => (lowPower = lowPower || (!b.charging && b.level <= 0.2));
      check();
      b.addEventListener('levelchange', check);
      b.addEventListener('chargingchange', check);
    }).catch(() => {});

    let W = 0, H = 0, dpr = 1;
    let threads: Thread[] = [];
    const braids: Braid[] = [];
    const pairCool = new Map<number, number>();
    let t = rand() * 100;
    let stretch = 0, stretchTarget = 0;
    let lastScrollY = window.scrollY, lastScrollT = performance.now();
    let px = -9999, py = -9999, pointerOn = false;
    let running = false, visible = true, raf = 0, lastFrame = 0, frame = 0;

    const count = () => {
      const base = W < 768 ? 26 : 56;
      return Math.max(6, Math.round(base * density));
    };

    const spawn = (th: Thread | null, anywhere: boolean): Thread => {
      const xs = th?.xs ?? new Float32Array(POINTS);
      const ys = th?.ys ?? new Float32Array(POINTS);
      const x = anywhere ? rand() * W : -STEP * 4 - rand() * 120;
      const y = rand() * H;
      xs.fill(x);
      ys.fill(y);
      return {
        xs, ys, head: 0, x, y, travel: 0,
        color: pal.colors[Math.floor(rand() * pal.colors.length)],
        alpha: pal.alpha[0] + rand() * (pal.alpha[1] - pal.alpha[0]),
        // Crosses the viewport in roughly 25 to 40 s.
        speed: 1 / (25 + rand() * 15),
        width: rand() < 0.2 ? 1.4 : 1,
      };
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      const nw = Math.max(1, Math.round(r.width));
      const nh = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (W && H) {
        const sx = nw / W, sy = nh / H;
        for (const th of threads) {
          th.x *= sx; th.y *= sy;
          for (let i = 0; i < POINTS; i++) { th.xs[i] *= sx; th.ys[i] *= sy; }
        }
      }
      W = nw; H = nh;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const n = count();
      while (threads.length < n) threads.push(spawn(null, true));
      threads.length = n;
    };

    const advance = (dt: number) => {
      t += dt * 0.00004;
      const scale = 0.0016;
      for (let k = 0; k < threads.length; k++) {
        const th = threads[k];
        // Base drift to the right, noise bends it up to about +/- 70 degrees.
        const a = noise(th.x * scale, th.y * scale, t + k * 0.013) * 1.25;
        const v = W * th.speed * (dt / 1000);
        const dx = Math.cos(a) * v;
        const dy = Math.sin(a) * v;
        th.x += dx; th.y += dy;
        th.travel += Math.hypot(dx, dy);
        if (th.travel >= STEP) {
          th.travel = 0;
          th.head = (th.head + 1) % POINTS;
        }
        th.xs[th.head] = th.x;
        th.ys[th.head] = th.y;
        // Respawn once the whole trail has left the canvas.
        const tail = (th.head + 1) % POINTS;
        if (th.xs[tail] > W + 40 || th.ys[tail] < -60 || th.ys[tail] > H + 60) threads[k] = spawn(th, false);
      }
    };

    const findBraids = (now: number) => {
      const cell = BRAID_DIST;
      const grid = new Map<number, number[]>();
      const key = (cx: number, cy: number) => cx * 73856093 ^ cy * 19349663;
      for (let k = 0; k < threads.length; k++) {
        const th = threads[k];
        for (let i = 0; i < POINTS; i += 3) {
          const x = th.xs[i], y = th.ys[i];
          if (x < 0 || x > W || y < 0 || y > H) continue;
          const kk = key(Math.floor(x / cell), Math.floor(y / cell));
          const list = grid.get(kk);
          const entry = k * POINTS + i;
          if (list) {
            for (const other of list) {
              const ok = Math.floor(other / POINTS);
              if (ok === k) continue;
              const pair = Math.min(ok, k) * 1000 + Math.max(ok, k);
              if ((pairCool.get(pair) || 0) > now) continue;
              const oi = other % POINTS;
              const o = threads[ok];
              if (Math.hypot(o.xs[oi] - x, o.ys[oi] - y) > BRAID_DIST) continue;
              pairCool.set(pair, now + 2600);
              if (braids.length < 14) braids.push({ a: k, ai: i, b: ok, bi: oi, born: now });
            }
            list.push(entry);
          } else grid.set(kk, [entry]);
        }
      }
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // Scroll stretch: vertical scale around the middle.
      const sy = 1 + stretch;
      ctx.setTransform(dpr, 0, 0, dpr * sy, 0, dpr * (H / 2) * (1 - sy));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const bend = (x: number, y: number): [number, number] => {
        if (!pointerOn) return [x, y];
        const dx = px - x, dy = py - y;
        const d = Math.hypot(dx, dy);
        if (d > POINTER_R || d < 0.001) return [x, y];
        const f = Math.pow(1 - d / POINTER_R, 2) * 22;
        return [x + (dx / d) * f, y + (dy / d) * f];
      };
      for (const th of threads) {
        ctx.beginPath();
        let i = (th.head + 1) % POINTS;
        let [x0, y0] = bend(th.xs[i], th.ys[i]);
        ctx.moveTo(x0, y0);
        for (let n = 1; n < POINTS; n++) {
          i = (i + 1) % POINTS;
          const [x1, y1] = bend(th.xs[i], th.ys[i]);
          ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          x0 = x1; y0 = y1;
        }
        ctx.lineTo(x0, y0);
        ctx.strokeStyle = `rgba(${th.color},${th.alpha})`;
        ctx.lineWidth = th.width;
        ctx.stroke();
      }
      // Braids: where two threads met, both glow briefly along a short span, then separate.
      const span = (th: Thread, at: number, a: number) => {
        // Walk in trail order (0 = oldest) so the span never wraps from newest to oldest.
        const d = (at - th.head - 1 + POINTS) % POINTS;
        const from = Math.max(0, d - 5);
        const to = Math.min(POINTS - 1, d + 5);
        ctx.beginPath();
        for (let j = from; j <= to; j++) {
          const idx = (th.head + 1 + j) % POINTS;
          const [x, y] = bend(th.xs[idx], th.ys[idx]);
          if (j === from) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${th.color},${a})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      };
      for (let b = braids.length - 1; b >= 0; b--) {
        const br = braids[b];
        const age = (now - br.born) / BRAID_LIFE;
        if (age >= 1 || !threads[br.a] || !threads[br.b]) { braids.splice(b, 1); continue; }
        const life = Math.sin(Math.PI * Math.min(1, age * 1.6)) * (1 - age * 0.6);
        const peak = variant === 'dark' ? 0.3 : 0.34;
        span(threads[br.a], br.ai, peak * life);
        span(threads[br.b], br.bi, peak * life);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const minGap = lowPower ? 1000 / 30 - 2 : 0;
      if (now - lastFrame < minGap) return;
      const dt = Math.min(64, lastFrame ? now - lastFrame : 16);
      lastFrame = now;
      stretch += (stretchTarget - stretch) * Math.min(1, dt / 90);
      stretchTarget *= Math.exp(-dt / 200); // eases back over ~600ms
      advance(dt);
      if (++frame % 6 === 0) findBraids(now);
      draw(now);
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
      running = true;
      lastFrame = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    // Pre-warm so every thread has a full trail on first paint.
    for (let i = 0; i < (reduced ? 900 : 600); i++) advance(16);
    draw(performance.now());
    canvas.classList.add('is-ready');

    const ro = new ResizeObserver(() => { resize(); if (!running) draw(performance.now()); });
    ro.observe(host);
    if (reduced) return () => ro.disconnect();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
    io.observe(host);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    const onScroll = () => {
      const now = performance.now();
      const v = (window.scrollY - lastScrollY) / Math.max(16, now - lastScrollT); // px per ms
      lastScrollY = window.scrollY;
      lastScrollT = now;
      stretchTarget = Math.max(-0.22, Math.min(0.22, stretchTarget + v * 0.06));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      pointerOn = px > -POINTER_R && py > -POINTER_R && px < r.width + POINTER_R && py < r.height + POINTER_R;
    };
    const onLeave = () => (pointerOn = false);
    if (finePointer) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [variant, density, seed]);

  return <canvas ref={ref} className="threads-canvas" aria-hidden="true" />;
}
