import type { APIRoute, GetStaticPaths } from 'astro';
import { getPosts } from '../../lib/blog';
import { renderOg, featuredFile, photo } from '../../lib/og';
import { CATEGORIES, slugify } from '../../data/site';

type OgProps = { title: string; eyebrow: string; photo: string; position?: string };

export const getStaticPaths = (async () => {
  const pages: { slug: string; props: OgProps }[] = [
    { slug: 'home', props: { title: 'Creating Cultures of Belonging, Connection, and Inclusion', eyebrow: 'DR. ROZ COHEN OF SOCIUS STRATEGIES', photo: photo('roscohen_164.jpg') } },
    { slug: 'about', props: { title: 'About Dr. Roz', eyebrow: "HI, I'M ROZ!", photo: photo('roscohen_46.jpg') } },
    { slug: 'speaking', props: { title: 'Building & Operationalizing Radically Connected Cultures', eyebrow: 'SPEAKING', photo: photo('rda_-_project_equity_-_fall_2023-98.jpg') } },
    { slug: 'dr-roz-collaborations', props: { title: 'Create Cultures of Inclusion, Belonging, and Connection', eyebrow: 'DR. ROZ COLLABORATIONS', photo: photo('roscohen_190.jpg') } },
    { slug: 'blog', props: { title: 'Leadership, Culture, & Food', eyebrow: 'THE BLOG', photo: photo('shuk_-_israel.jpg') } },
    { slug: 'contact-us', props: { title: 'Get In Touch With Dr. Roz', eyebrow: 'CONTACT', photo: photo('roscohen_86.jpg') } },
    { slug: '404', props: { title: 'Page not found.', eyebrow: 'DR. ROZ COHEN', photo: photo('roscohen_172.jpg') } },
    ...CATEGORIES.map((c) => ({
      slug: `category-${slugify(c)}`,
      props: { title: c, eyebrow: 'BLOG CATEGORY', photo: photo('roscohen_204.jpg') },
    })),
  ];
  const posts = (await getPosts()).map((p) => ({
    slug: `post-${p.data.slug}`.slice(0, 120),
    props: {
      title: p.data.title,
      eyebrow: 'DR. ROZ COHEN | BLOG',
      photo: (p.filePath && featuredFile(p.filePath)) || photo('roscohen_86.jpg'),
    },
  }));
  return [...pages, ...posts].map(({ slug, props }) => ({ params: { slug }, props }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOg(props as OgProps);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/jpeg' } });
};
