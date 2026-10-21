import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      slug: z.string(),
      categories: z.array(z.string()).default([]),
      featuredImage: image().optional(),
      featuredAlt: z.string().default(''),
      excerpt: z.string().default(''),
      sourceUrl: z.string().optional(),
      linkedinEmbed: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
