// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { rehypeHashtags } from './src/lib/rehype-hashtags.mjs';

const SITE = 'https://drrozcohen.com';

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !/\/(admin|dev|thank-you|og)\//.test(page) && !/\/404\/?$/.test(page),
    }),
  ],
  markdown: {
    processor: unified({ rehypePlugins: [rehypeHashtags] }),
  },
  image: {
    layout: 'constrained',
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
