import { useEffect, useState } from 'react';

/**
 * Category pills for the blog. Server-rendered as plain links to each category archive
 * (works with JS off). On the blog index, once hydrated, the pills become toggle buttons
 * that filter the cards on the current page in place; the archive link stays one click away.
 */
type Cat = { name: string; href: string };
type Props = {
  categories: Cat[];
  allHref: string;
  /** Category name of the current archive (links mode). */
  current?: string;
  /** 'filter' on /blog/ pages (hydrated), 'links' on category archives (static). */
  mode?: 'filter' | 'links';
};

export default function BlogFilter({ categories, allHref, current, mode = 'links' }: Props) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string>('ALL');
  const [count, setCount] = useState<number | null>(null);
  const filtering = mode === 'filter' && ready;

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!filtering) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-post-card]'));
    let n = 0;
    cards.forEach((c) => {
      const cats = (c.dataset.categories || '').split('|');
      const show = active === 'ALL' || cats.includes(active);
      c.hidden = !show;
      if (show) n++;
    });
    document.querySelector('[data-post-grid]')?.classList.toggle('is-filtered', active !== 'ALL');
    setCount(active === 'ALL' ? null : n);
    // Shown cards may never have revealed (they were hidden); let the motion system catch up.
    const grid = document.querySelector('[data-post-grid]');
    if (grid) window.LWS?.observe(grid);
  }, [active, filtering]);

  const activeCat = categories.find((c) => c.name === active);
  const all = [{ name: 'ALL', href: allHref }, ...categories];

  return (
    <div className="bfilter" role="group" aria-label="Filter posts by category">
      {all.map((c) =>
        filtering ? (
          <button key={c.name} type="button" className="bfilter__pill" aria-pressed={active === c.name} onClick={() => setActive(c.name)}>
            {c.name}
          </button>
        ) : (
          <a
            key={c.name}
            className="bfilter__pill"
            href={c.href}
            aria-current={(c.name === 'ALL' && !current) || current === c.name ? 'page' : undefined}
          >
            {c.name}
          </a>
        ),
      )}
      <p className="bfilter__status" aria-live="polite">
        {filtering && count !== null && activeCat && (
          <>
            {count === 0 ? 'No ' : `${count} `}
            {activeCat.name} {count === 1 ? 'post' : 'posts'} on this page. <a href={activeCat.href}>See all {activeCat.name} posts</a>
          </>
        )}
      </p>
    </div>
  );
}
