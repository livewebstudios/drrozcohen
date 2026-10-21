/**
 * One motion system for the whole site (GSAP + ScrollTrigger, native scroll).
 * Every animation lives inside gsap.matchMedia() so reduced motion gets a static branch.
 *
 * Hooks (data attributes):
 *   data-reveal                 fade up 16px, 600ms, power2.out, once
 *   data-reveal-group           children with data-reveal stagger 60ms
 *   data-parallax="0.7"         element moves at 0.7x scroll speed (transform only)
 *   data-parallax-inner         photo glides at 0.8x inside its fixed arch frame
 *   data-draw / data-draw="scrub"  SVG path draws itself (once, or scrubbed to scroll)
 *   data-word-scrub             words go from 25% to 100% opacity as the block scrolls
 *   data-focus-band             focus words light in sequence along an arch line
 *   data-header                 solid after 80px, hides on scroll down, returns on scroll up
 *   data-progress               reading progress bar (scaleX)
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/** Split an element's text into word spans (textContent stays identical). */
function splitWords(el: HTMLElement) {
  if (el.dataset.split) return $$<HTMLElement>('.w', el);
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent || '').split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
          else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = p;
            frag.appendChild(s);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    });
  };
  walk(el);
  el.dataset.split = '1';
  return $$<HTMLElement>('.w', el);
}

function prepDraw(path: SVGPathElement) {
  // pathLength="1" on the element normalises dash math.
  if (!path.getAttribute('pathLength')) path.setAttribute('pathLength', '1');
  path.style.strokeDasharray = '1';
}

// Timing comes from the CSS tokens so CSS transitions and GSAP stay in step.
const cs = getComputedStyle(document.documentElement);
const sec = (v: string, fallback: number) => {
  const raw = cs.getPropertyValue(v).trim();
  if (!raw) return fallback;
  return raw.endsWith('ms') ? parseFloat(raw) / 1000 : parseFloat(raw);
};
const T = {
  reveal: sec('--d-slow', 0.6),
  draw: sec('--d-draw', 1.6),
  stagger: sec('--stagger', 0.06),
  y: parseFloat(cs.getPropertyValue('--reveal-y')) || 16,
  ease: cs.getPropertyValue('--gsap-ease').trim() || 'power2.out',
};

/** Already on screen when motion loads (it loads lazily): leave it alone, no flash. */
const inView = (el: Element) => el.getBoundingClientRect().top < window.innerHeight * 0.92;

let motionOn = false;
function reveal(els: HTMLElement[], trigger: Element) {
  const todo = els.filter((e) => !e.dataset.revealed && !inView(e));
  els.forEach((e) => (e.dataset.revealed = '1'));
  if (!motionOn || !todo.length) return;
  gsap.from(todo, {
    y: T.y,
    opacity: 0,
    duration: T.reveal,
    ease: T.ease,
    stagger: T.stagger,
    scrollTrigger: { trigger, start: 'top 88%', once: true },
  });
}

const mm = gsap.matchMedia();

mm.add(
  {
    motion: '(prefers-reduced-motion: no-preference)',
    reduce: '(prefers-reduced-motion: reduce)',
    wide: '(min-width: 768px)',
  },
  (context) => {
    const { motion, wide } = context.conditions as { motion: boolean; reduce: boolean; wide: boolean };

    if (!motion) {
      // Static branch: everything visible, drawn lines complete, words at full opacity.
      $$<SVGPathElement>('[data-draw]').forEach((p) => {
        p.style.strokeDasharray = 'none';
        p.style.strokeDashoffset = '0';
      });
      $$('[data-focus-band]').forEach((band) => band.classList.add('is-lit-all'));
      return;
    }

    // ---------- Reveals ----------
    motionOn = true;
    const grouped = new Set<HTMLElement>();
    $$('[data-reveal-group]').forEach((group) => {
      const items = $$('[data-reveal]', group);
      items.forEach((i) => grouped.add(i));
      if (items.length) reveal(items, group);
    });
    $$('[data-reveal]')
      .filter((el) => !grouped.has(el))
      .forEach((el) => reveal([el], el));

    // ---------- Path draw ----------
    $$<SVGPathElement>('[data-draw]').forEach((path) => {
      prepDraw(path);
      const scrub = path.dataset.draw === 'scrub';
      if (!scrub && inView(path)) return; // already visible: keep it drawn
      const trigger = path.closest('[data-draw-trigger]') || path.closest('svg') || path;
      gsap.fromTo(
        path,
        { strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          ease: scrub ? 'none' : T.ease,
          duration: scrub ? 1 : T.draw,
          scrollTrigger: scrub
            ? { trigger, start: 'top 85%', end: 'bottom 45%', scrub: 0.6 }
            : { trigger, start: 'top 90%', once: true },
        },
      );
    });

    // ---------- Word scrub (quote band) ----------
    $$('[data-word-scrub]').forEach((el) => {
      const words = splitWords(el);
      gsap.fromTo(
        words,
        { opacity: 0.25 },
        {
          opacity: 1,
          ease: 'none',
          stagger: T.stagger,
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: 0.5 },
        },
      );
    });

    // ---------- Focus band: words light in sequence along the arch ----------
    $$('[data-focus-band]').forEach((band) => {
      const words = $$('[data-focus-word]', band);
      const line = band.querySelector<SVGPathElement>('[data-focus-line]');
      const tl = gsap.timeline({
        scrollTrigger: { trigger: band, start: 'top 75%', end: 'bottom 35%', scrub: 0.6 },
      });
      if (line) {
        prepDraw(line);
        tl.fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', duration: words.length }, 0);
      }
      words.forEach((w, i) => {
        tl.fromTo(w, { opacity: 0.35 }, { opacity: 1, ease: 'none', duration: T.reveal }, i + 0.2);
      });
    });

    // ---------- Parallax (transform only; off below 768px) ----------
    if (wide) {
      $$('[data-parallax]').forEach((el) => {
        const f = parseFloat(el.dataset.parallax || '1');
        if (!f || f === 1) return;
        const hero = el.closest('[data-hero]');
        const trigger = (hero || el.closest('section') || el) as HTMLElement;
        if (hero) {
          // Hero layers: offset grows as the hero scrolls away from the top.
          gsap.to(el, {
            y: () => (1 - f) * trigger.offsetHeight,
            ease: 'none',
            scrollTrigger: { trigger, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
          });
        } else {
          const range = () => (1 - f) * window.innerHeight * 0.3;
          gsap.fromTo(
            el,
            { y: () => -range() },
            {
              y: () => range(),
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
            },
          );
        }
      });
      $$('[data-parallax-inner]').forEach((el) => {
        const frame = el.parentElement as HTMLElement;
        gsap.fromTo(
          el,
          { yPercent: -6 },
          {
            yPercent: 6,
            ease: 'none',
            scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      });
    }
  },
);

// ---------- Public hook for content inserted or shown after load ----------
// window.LWS.observe(el): give new [data-reveal] content the same entrance.
// window.LWS.refresh(): recompute trigger positions after layout changes (blog filter).
declare global {
  interface Window {
    LWS?: { observe: (el: Element) => void; refresh: () => void };
  }
}
window.LWS = {
  observe(el: Element) {
    const items = el.matches('[data-reveal]') ? [el as HTMLElement] : $$('[data-reveal]', el);
    reveal(items, el);
    ScrollTrigger.refresh();
  },
  refresh() {
    ScrollTrigger.refresh();
  },
};

// Fonts and images change layout; keep trigger positions honest.
if (document.readyState === 'complete') ScrollTrigger.refresh();
else window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
