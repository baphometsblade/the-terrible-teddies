import { PUBLIC_DESCRIPTION, PUBLIC_SITE_ORIGIN, PUBLIC_TITLE } from './publicCopy.js';

// Schema.org for the public page. The same object is inlined in index.html
// (a crawler that does not run JavaScript still sees it). platform.test.js
// parses that script and fails if it drifts from this function.
export function structuredData(origin = PUBLIC_SITE_ORIGIN) {
  const site = String(origin).replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: 'Terrible Teddies',
    alternateName: PUBLIC_TITLE,
    url: `${site}/`,
    image: `${site}/og-image.jpg`,
    description: PUBLIC_DESCRIPTION,
    contentRating: '18+',
    applicationCategory: 'Game',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}
