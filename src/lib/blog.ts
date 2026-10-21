import { getCollection, type CollectionEntry } from 'astro:content';
import { slugify } from '../data/site';

export type Post = CollectionEntry<'blog'>;

export const PAGE_SIZE = 12;
const pad = (n: number) => String(n).padStart(2, '0');

/** WordPress permalink: /YYYY/MM/DD/<slug>/ using UTC date parts (the live site runs on UTC). */
export function postPath(post: Post) {
  const d = post.data.date;
  return `/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${post.data.slug}/`;
}

export function postParams(post: Post) {
  const d = post.data.date;
  return { year: String(d.getUTCFullYear()), month: pad(d.getUTCMonth() + 1), day: pad(d.getUTCDate()), slug: post.data.slug };
}

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const categoryPath = (name: string) => `/category/${slugify(name)}/`;

export function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function isoDate(d: Date) {
  return d.toISOString();
}

/** Posts sharing a category with `post`, most shared first, then newest. */
export function relatedPosts(post: Post, all: Post[], n = 3) {
  const cats = new Set(post.data.categories.filter((c) => c !== 'Uncategorized'));
  return all
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, score: p.data.categories.filter((c) => cats.has(c)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.data.date.getTime() - a.p.data.date.getTime())
    .slice(0, n)
    .map((x) => x.p);
}

/** Card/meta excerpt: frontmatter excerpt, else the first 28 words of the body (CMS posts). */
export function getExcerpt(post: Post) {
  if (post.data.excerpt) return post.data.excerpt;
  const words = (post.body || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.length ? words.slice(0, 28).join(' ').replace(/[,;:.!?]+$/, '') + '…' : '';
}
