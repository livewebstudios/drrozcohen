import { useEffect, useRef } from 'react';

/**
 * Structured arch field (replaces the free-flowing "Living Threads").
 * Concentric bridge arches, taken from the logo, rise from below the section and expand
 * outward together at an even pace. A short highlight travels across each arch, staggered
 * ring by ring, so a calm diagonal wave sweeps the field: connection moving across a bridge.
 * Canvas 2D, DPR capped at 1.5, paused offscreen and in hidden tabs, 30fps on low-power
 * devices, one static frame under prefers-reduced-motion. Decorative: aria-hidden.
 */
type Props = {
  variant?: 'light' | 'dark';
  /** Ring density: 1 = default spacing, lower = more open. */
  density?: number;
  /** Stable per-page variation (highlight phase). */
  seed?: number;
  /** Horizontal center of the arches, 0 to 1 across the section. */
  anchor?: number;
};

const ALPHA = { light: { ring: 0.16, glow: 0.5 }, dark: { ring: 0.14, glow: 0.42 } } as const;
const TONES = { light: ['--plum', '--orchid', '--slate'], dark: ['--orchid', '--paper'] } as const;
const ASPECT = 1.7; // arches are wider than tall, like the logo
const PERIOD = 7; // seconds for the field to move out by one ring
const SWEEP = 11; // seconds for a highlight to cross an arch
const SPAN = 0.16; // highlight length, fraction of the arch

function palette(variant: 'light' | 'dark') {
  const cs = getComputedStyle(document.documentElement);
  return TONES[variant].map((v) => {
    const h = cs.getPropertyValue(v).trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  });
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function ThreadsBackground({ variant = 'light', density = 1, seed = 1, anchor = 0.5 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    // astro-island is display: contents, so measure the positioned wrapper instead.
    const host = (canvas?.closest('.threads-bg') as HTMLElement | null) ?? canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;

    const colors = palette(variant);
    const alpha = ALPHA[variant];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lowPower = (navigator.hardwareConcurrency || 8) <= 4;
    type BatteryLike = { level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    nav.getBattery?.().then((b) => {
      const check = () => (lowPower = lowPower || (!b.charging && b.level <= 0.2));
      check();
      b.addEventListener('levelchange', check);
      b.addEventListener('chargingchange', check);
    }).catch(() => {});

    let W = 0, H = 0, dpr = 1, spacing = 44;
    let clock = (seed * 1.37) % PERIOD; // seconds of field motion
    let boost = 0; // extra speed from scrolling, eases back
    let lastY = window.scrollY;
    let running = false, visible = true, raf = 0, last = 0;

    const resize = () => {
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const base = W < 768 ? 52 : 44;
      spacing = base / Math.max(0.35, Math.min(1.4, density));
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W * anchor;
      const cy = H * 1.08; // arches rise from just below the section
      const reach = Math.max(Math.hypot(Math.max(cx, W - cx) / ASPECT, cy), spacing * 4);
      const shift = (clock / PERIOD) * spacing;
      const passed = Math.floor(clock / PERIOD); // rings that have moved one step out
      const count = Math.ceil(reach / spacing) + 1;
      ctx.lineCap = 'round';
      for (let k = 0; k < count; k++) {
        const r = k * spacing + (shift % spacing);
        if (r < spacing * 0.5) continue;
        // Fade in near the center, fade out at the edge of the field.
        const env = smooth(spacing * 0.5, spacing * 3, r) * (1 - smooth(reach * 0.55, reach, r));
        if (env <= 0.001) continue;
        const id = k - passed; // stable identity as the ring travels outward
        const color = colors[((id % colors.length) + colors.length) % colors.length];
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * ASPECT, r, 0, Math.PI, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color},${alpha.ring * env})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Highlight: staggered by ring so the field reads as one calm diagonal wave.
        const p = (((clock / SWEEP + id * 0.085 + seed * 0.13) % 1) + 1) % 1;
        const a0 = Math.PI + p * Math.PI * (1 + SPAN) - Math.PI * SPAN;
        const a1 = a0 + Math.PI * SPAN;
        const from = Math.max(Math.PI, a0);
        const to = Math.min(Math.PI * 2, a1);
        if (to <= from) continue;
        const fade = Math.sin(p * Math.PI);
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * ASPECT, r, 0, from, to);
        ctx.strokeStyle = `rgba(${color},${alpha.glow * env * fade})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const minGap = lowPower ? 1000 / 30 - 2 : 0;
      if (now - last < minGap) return;
      const dt = Math.min(0.064, last ? (now - last) / 1000 : 0.016);
      last = now;
      boost *= Math.exp(-dt / 0.2); // eases back over ~600ms
      clock += dt * (1 + boost);
      draw();
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    draw();
    canvas.classList.add('is-ready');

    const ro = new ResizeObserver(() => { resize(); if (!running) draw(); });
    ro.observe(host);
    if (reduced) return () => ro.disconnect();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
    io.observe(host);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    // Scrolling nudges the field outward a little faster, then it settles.
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      boost = Math.min(3, boost + dy / 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('scroll', onScroll);
    };
  }, [variant, density, seed, anchor]);

  return <canvas ref={ref} className="threads-canvas" aria-hidden="true" />;
}
