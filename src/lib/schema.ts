import { SITE } from '../data/site';

export const ID = {
  website: `${SITE.url}/#website`,
  person: `${SITE.url}/#roz`,
  org: `${SITE.url}/#socius`,
};

export const abs = (path: string) => new URL(path, SITE.url).href;

/** Site-wide nodes present on every page. */
export function siteGraph(opts: { logo: string; portrait: string }) {
  return [
    {
      '@type': 'WebSite',
      '@id': ID.website,
      url: `${SITE.url}/`,
      name: SITE.name,
      inLanguage: 'en-US',
      publisher: { '@id': ID.org },
    },
    {
      '@type': 'Person',
      '@id': ID.person,
      name: 'Roz Cohen',
      alternateName: ['Dr. Roz Cohen', 'Rosalind F. Cohen, Ph.D.'],
      honorificSuffix: 'Ph.D.',
      jobTitle: 'Founder',
      worksFor: { '@id': ID.org },
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'Antioch University' },
      knowsAbout: ['Inclusion', 'Belonging', 'Employee engagement', 'Inclusive leadership'],
      sameAs: [SITE.linkedin],
      url: abs('/about/'),
      image: opts.portrait,
    },
    {
      '@type': 'ProfessionalService',
      '@id': ID.org,
      name: SITE.org,
      url: `${SITE.url}/`,
      email: SITE.email,
      logo: opts.logo,
      image: opts.portrait,
      founder: { '@id': ID.person },
      areaServed: { '@type': 'Country', name: 'United States' },
      address: { '@type': 'PostalAddress', addressLocality: 'San Francisco', addressRegion: 'CA', addressCountry: 'US' },
      sameAs: [SITE.linkedin],
    },
  ];
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}
