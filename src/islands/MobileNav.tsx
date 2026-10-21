import { useCallback, useEffect, useRef, useState } from 'react';

type Item = { label: string; href: string; current?: boolean };

/**
 * Full-screen mobile menu (below 1024px). Focus is trapped inside while open, Escape and
 * CLOSE dismiss it, focus returns to the MENU button, and the page behind is inert.
 */
export default function MobileNav({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const main = document.getElementById('main');
    const footer = document.querySelector<HTMLElement>('.site-footer');
    root.classList.toggle('menu-open', open);
    [main, footer].forEach((el) => el && (open ? el.setAttribute('inert', '') : el.removeAttribute('inert')));
    if (!open) return;
    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onResize = () => window.matchMedia('(min-width: 1024px)').matches && setOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  return (
    <div className="mnav">
      <button
        ref={buttonRef}
        type="button"
        className="mnav__toggle"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
      >
        <span className="mnav__bars" aria-hidden="true">
          <span />
          <span />
        </span>
        MENU
      </button>
      <div
        id="mobile-menu"
        ref={panelRef}
        className={`mnav__panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
      >
        <div className="mnav__top">
          <button type="button" className="mnav__close" onClick={close}>
            CLOSE
          </button>
        </div>
        <nav aria-label="Mobile">
          <ul className="mnav__list" role="list">
            {items.map((item, i) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="mnav__link"
                  aria-current={item.current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="mnav__num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
