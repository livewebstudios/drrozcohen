/** URL of a page's build-time OG image (see src/pages/og/[slug].png.ts). */
export const ogPath = (key: string) => `/og/${key.slice(0, 120)}.jpg`;
export const postOgPath = (slug: string) => ogPath(`post-${slug}`);
