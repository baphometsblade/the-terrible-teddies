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
