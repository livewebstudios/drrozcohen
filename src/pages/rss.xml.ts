import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, postPath, getExcerpt } from '../lib/blog';
import { hero } from '../data/pages/blog';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `Dr. Roz Cohen: ${hero.title}`,
    description: hero.intro,
    site: context.site ?? 'https://drrozcohen.com',
    trailingSlash: true,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: getExcerpt(p),
      link: postPath(p),
      categories: p.data.categories,
    })),
    customData: '<language>en-us</language>',
  });
}
