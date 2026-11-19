// Which public page a path is, if it is one of the two plain legal pages.
// Anything else is the game, which the age gate still stands in front of.
// A trailing slash is the same page. The date of birth never travels with
// the address.

export const legalKind = (pathname) => {
  const path = String(pathname ?? '/').replace(/\/+$/, '') || '/';
  if (path === '/terms') return 'terms';
  if (path === '/privacy') return 'privacy';
  return null;
};

// The address a legal page calls its own. index.html's canonical link (and
// og:url) name the site root, written at build time from the site origin
// (src/lib/siteMeta.js). Left alone on /terms and /privacy, they tell search
// engines both pages are copies of the home page, which contradicts the
// sitemap and drops them from results. The origin is taken from the build's
// canonical so a custom domain or VITE_SITE_URL is kept.
export function legalCanonical(kind, canonicalHref) {
  if (kind !== 'terms' && kind !== 'privacy') return null;
  try {
    const base = new URL(String(canonicalHref ?? ''));
    if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
    return `${base.origin}${base.pathname.replace(/\/+$/, '')}/${kind}`;
  } catch {
    return null;
  }
}

// Points the document's canonical link and og:url at `href` while a legal
// page is up. Returns the undo, which puts the build's values back.
export function pointCanonicalAt(href, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || !href) return () => {};
  const link = doc.querySelector('link[rel="canonical"]');
  const og = doc.querySelector('meta[property="og:url"]');
  const before = { link: link?.getAttribute('href'), og: og?.getAttribute('content') };
  link?.setAttribute('href', href);
  og?.setAttribute('content', href);
  return () => {
    if (link && before.link != null) link.setAttribute('href', before.link);
    if (og && before.og != null) og.setAttribute('content', before.og);
  };
}
