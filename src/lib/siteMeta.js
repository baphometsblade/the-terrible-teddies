// The link preview's absolute URLs, written into index.html at build time by
// vite.config.js (its social-meta plugin). Build tooling, run in Node: the
// app never imports this.
//
// Open Graph and X want absolute URLs, and Facebook's, X's and LinkedIn's
// scrapers do not resolve a relative one, so the old
// <meta property="og:image" content="/og-image.jpg"> gave most shared links
// no picture. The site's address is not in the repo, so it comes from the
// build's environment, and with none set the tags are left out rather than
// guessed: a wrong absolute URL is worse than none.

export const OG_IMAGE = { path: '/og-image.jpg', width: 1200, height: 630, type: 'image/jpeg' };
export const OG_IMAGE_ALT =
  "Three Terrible Teddies cards fanned beside the game's brass wordmark on a dark bar-room backdrop.";

/**
 * The site's origin (and base path, if any), without a trailing slash:
 * VITE_SITE_URL if it is set, else the production domain Vercel's build
 * provides (VERCEL_PROJECT_PRODUCTION_URL, a bare host), else null. An
 * address that is set but is not an absolute http(s) URL fails the build
 * rather than shipping a broken preview.
 */
export function siteUrlFrom(env = {}) {
  const raw = (env.VITE_SITE_URL || '').trim()
    || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : '');
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`VITE_SITE_URL must be an absolute URL such as https://example.com (got "${raw}")`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`VITE_SITE_URL must be an http(s) URL (got "${raw}")`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

const meta = (attrs) => ({ tag: 'meta', attrs, injectTo: 'head' });

/** The absolute-URL tags for a site at `site` (from siteUrlFrom). */
export function socialMetaTags(site) {
  const image = `${site}${OG_IMAGE.path}`;
  return [
    meta({ property: 'og:url', content: `${site}/` }),
    meta({ property: 'og:image', content: image }),
    meta({ property: 'og:image:type', content: OG_IMAGE.type }),
    meta({ property: 'og:image:width', content: String(OG_IMAGE.width) }),
    meta({ property: 'og:image:height', content: String(OG_IMAGE.height) }),
    meta({ property: 'og:image:alt', content: OG_IMAGE_ALT }),
    meta({ name: 'twitter:image', content: image }),
    meta({ name: 'twitter:image:alt', content: OG_IMAGE_ALT }),
  ];
}
