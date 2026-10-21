// Site-wide settings and UI strings authored by LWS (not client copy).
import type { ImageMetadata } from 'astro';

import featured1 from '../assets/images/brand/logos/featured-in-1.png';
import featured2 from '../assets/images/brand/logos/featured-in-2.png';
import featured3 from '../assets/images/brand/logos/featured-in-3.png';
import featured4 from '../assets/images/brand/logos/featured-in-4.png';
import featured5 from '../assets/images/brand/logos/featured-in-5.png';
import trusted1 from '../assets/images/brand/logos/trusted-by-1.png';
import trusted2 from '../assets/images/brand/logos/trusted-by-2.png';
import trusted3 from '../assets/images/brand/logos/trusted-by-3.png';
import trusted4 from '../assets/images/brand/logos/trusted-by-4.png';
import trusted5 from '../assets/images/brand/logos/trusted-by-5.png';
import trusted6 from '../assets/images/brand/logos/trusted-by-6.png';
import talks1 from '../assets/images/brand/logos/past-talks-1.png';
import talks2 from '../assets/images/brand/logos/past-talks-2.png';
import talks3 from '../assets/images/brand/logos/past-talks-3.png';
import talks4 from '../assets/images/brand/logos/past-talks-4.png';

export const SITE = {
  url: 'https://drrozcohen.com',
  name: 'Dr. Roz Cohen of Socius Strategies',
  shortName: 'Dr. Roz Cohen',
  org: 'Socius Strategies',
  email: 'info@drrozcohen.com',
  linkedin: 'https://www.linkedin.com/in/rosalindfcohen/',
  locale: 'en_US',
  lwsUrl: 'https://livewebstudios.com',
};

export const NAV = [
  { label: 'HOME', href: '/' },
  { label: 'ABOUT', href: '/about/' },
  { label: 'SPEAKING', href: '/speaking/' },
  { label: 'DR. ROZ COLLABORATIONS', href: '/dr-roz-collaborations/' },
  { label: 'BLOG', href: '/blog/' },
  { label: 'CONTACT', href: '/contact-us/' },
] as const;

/** Footer "Focus" list, as on the live footer. */
export const FOCUS = ['CULTURE', 'INCLUSION', 'CONNECTION', 'BELONGING'] as const;

export type Logo = { src: ImageMetadata; alt: string };

export const LOGOS: Record<'featured' | 'trusted' | 'talks', Logo[]> = {
  featured: [
    { src: featured1, alt: 'Talent Talk Podcast' },
    { src: featured2, alt: 'HBIC, Head Boss in Charge' },
    { src: featured3, alt: 'Medium' },
    { src: featured4, alt: 'Lead at Any Level' },
    { src: featured5, alt: "Entrepreneurs' Organization" },
  ],
  trusted: [
    { src: trusted1, alt: 'American Jewish University' },
    { src: trusted2, alt: 'Hall Capital Partners' },
    { src: trusted3, alt: 'Dayton Public Schools' },
    { src: trusted4, alt: 'RHF' },
    { src: trusted5, alt: 'Safe and Sound' },
    { src: trusted6, alt: 'Vayu' },
  ],
  talks: [
    { src: talks1, alt: 'Inspire HR West' },
    { src: talks2, alt: 'Signature Leaders' },
    { src: talks3, alt: 'Diversity, Equity, Inclusion and Belonging Virtual Summit' },
    { src: talks4, alt: 'Engineer Inclusion' },
  ],
};

/** Blog categories shown as filter pills (Uncategorized is hidden but still listed under ALL). */
export const CATEGORIES = [
  'Belonging',
  'Connection',
  'Engagement',
  'Inclusion',
  'Inclusive Leadership',
  'Mentor',
  'Organizational Trust',
  'Unconscious Bias',
] as const;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
