# DrRozCohen.com

Astro rebuild of drrozcohen.com (previously WordPress/Divi) for Dr. Roz Cohen of Socius Strategies.
Static site, React islands for four interactive pieces, GSAP scroll motion, Decap CMS for blog posts.
Built by Live Web Studios.

## Run it

Requires Node 22.22 or newer (built on Node 24).

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs dist/
npm run preview    # serves dist/ locally
```

## Environment variables

Copy `.env.example` to `.env` for local builds, and set the same keys in Netlify
(Site configuration > Environment variables).

| Key | What it does |
|---|---|
| `PUBLIC_FORMSPREE_ID` | Optional. The form ID after `https://formspree.io/f/`. Defaults to the live form `mdearpoj`; both contact forms (home and Contact page) post there. |
| `PUBLIC_GA4_ID` | GA4 measurement ID (`G-...`). When empty, no analytics script is output at all; the `<!-- GA4: G-XXXXXXXXXX -->` placeholder comment stays in every page head. |

## How Roz adds a blog post (Decap CMS)

1. Go to `https://drrozcohen.com/admin/` and log in with Netlify Identity.
2. Choose **Blog**, then **New Post**.
3. Fill in Title, Publish date, URL slug (lowercase words with hyphens), at least one Category
   (the first one shows on the post card), Featured image and its description, then the Body.
   Excerpt is optional: leave it empty and the first 28 words are used.
4. **Publish**. Decap commits a Markdown file to `src/content/blog/`, Netlify rebuilds, and the post
   is live at `/YYYY/MM/DD/slug/` in about a minute. Tick **Draft** to save without publishing.

Decap is pinned to exactly `3.1.2` in `public/admin/index.html` (later versions crash on empty image
fields). Do not change it to a caret range.

## How Jon deploys

1. Create the repo `livewebstudios/drrozcohen` on GitHub and push this folder (`build/`) as the repo root:
   `git remote add origin https://github.com/livewebstudios/drrozcohen.git && git push -u origin main`.
2. In Netlify: Add new site > Import from GitHub > `livewebstudios/drrozcohen`. Build settings come from
   `netlify.toml` (`npm run build`, publish `dist`, Node 24).
3. Set `PUBLIC_GA4_ID` in Netlify environment variables (Formspree defaults to `mdearpoj`), then redeploy.
4. Site configuration > Identity: enable it, set registration to **Invite only**, then enable
   **Git Gateway** under Identity > Services.
5. Identity > Invite users: invite Roz (`roz@drrozcohen.com`). Invite links open the site and forward
   to `/admin/` automatically.
6. Test on the `.netlify.app` URL: every page, the contact form (check Formspree receives it), `/admin/`.
7. Point DNS for drrozcohen.com at Netlify (Domain management > Add a domain), wait for the SSL
   certificate, then confirm the old WordPress URLs redirect (`/contact/`, `/feed/`, `/author/...`).
8. Google Search Console: add the `drrozcohen.com` domain property (DNS TXT verification), then
   submit `https://drrozcohen.com/sitemap-index.xml` under Sitemaps. Use URL Inspection on the home page
   and one post to request indexing. The old `wp-sitemap.xml` and `sitemap.xml` 301 to the new sitemap.

## Project map

```
public/admin/            Decap CMS (LWS branded login, config.yml)
public/_redirects        WordPress URL redirects (see ../URL_AUDIT.md)
src/data/pages/*.ts      Page copy, verbatim and client approved. Change words only with Roz's sign-off.
src/data/site.ts         Nav, footer lists, logo strips, categories (LWS-authored UI strings)
src/content/blog/*.md    53 imported posts + anything Roz adds in the CMS
src/assets/images/       brand/, photos/, blog/ (processed; Astro serves AVIF/WebP)
src/components/          Astro components (ArchMotif, ArchFrame, Header, Footer, ...)
src/islands/             React islands: ThreadsBackground, MobileNav, ContactForm, BlogFilter
src/scripts/chrome.ts    Header state, reading progress, scroll-spy (runs immediately)
src/scripts/motion.ts    GSAP reveals, parallax, path draws, scrubs (loads at idle); window.LWS.observe()
src/pages/og/[slug].jpg.ts  Build-time Open Graph images
src/styles/tokens.css    Every color, space, radius and duration
scripts/                 Asset pipeline, blog importer and the QA/verification suite
```

## Scripts

| Command | What it does |
|---|---|
| `npm run assets:fetch` | Re-download and process images from the old site (raw files go to `images/raw/`, not committed) |
| `npm run blog:import` | Re-import posts from the live WordPress site and LinkedIn embeds |
| `npm run verify:static` | Copy integrity, kill-list, SEO, contrast and URL audit against `dist/` |
| `npm run verify:browser` | Playwright + axe QA, layout audit, motion check (needs `npm run preview` on port 4392: `npm run preview -- --port 4392`) |

Playwright uses the installed Google Chrome (`channel: 'chrome'`).

## Notes

- The League Script font is subset to the two phrases that use it ("Hi, I'm Roz!", "Ruth Bader Ginsburg").
  If new script text is added, regenerate `src/assets/fonts/league-script-subset.woff2` with `pyftsubset`.
- Copy rules: client copy is locked. LWS-authored strings follow the kill-list (no em/en dashes, no
  "submit", "click here", "learn more", "read more").
