/** Lightweight page chrome that must run immediately: header state, reading progress, scroll-spy. */
// ---------- Header: solid after 80px, hide on scroll down, return on scroll up ----------
const header = document.querySelector<HTMLElement>('[data-header]');
if (header) {
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const menuOpen = document.documentElement.classList.contains('menu-open');
    header.classList.toggle('is-solid', y > 80);
    if (!menuOpen) {
      if (y > lastY + 4 && y > header.offsetHeight * 2) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y <= 80) header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

// ---------- Reading progress ----------
const bar = document.querySelector<HTMLElement>('[data-progress]');
if (bar) {
  const target = document.querySelector<HTMLElement>(bar.dataset.progress || 'article') || document.body;
  let ticking = false;
  const update = () => {
    const r = target.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    bar.style.transform = `scaleX(${p})`;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  window.addEventListener('resize', update);
  update();
}

// ---------- Scroll-spy (Speaking keynote index) ----------
document.querySelectorAll<HTMLElement>('[data-scrollspy]').forEach((nav) => {
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('[data-spy-link]'));
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-spy-target]'));
  let ticking = false;
  const update = () => {
    const line = window.innerHeight * 0.4;
    // The last target whose top has passed 40% of the viewport, else the first.
    const current = targets.filter((t) => t.getBoundingClientRect().top <= line).pop() || targets[0];
    links.forEach((l) => l.setAttribute('aria-current', String(l.hash.slice(1) === current?.id)));
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
});
