// Start the pictures a fight is about to show, the moment the player sits
// down, so the first hand is not a row of empty frames. Thumbs only: the
// board draws those, and the full plates are several times the size.

// A card id is a positive integer, or an expansion slug such as ma-1.
// Anything else (a path, a blank, a joke string) is not a file we will ask for.
const SLUG = /^[a-z]{2,6}-[a-z0-9-]{1,40}$/;
const THUMB = /^\/cards\/thumbs\/(\d+|[a-z]{2,6}-[a-z0-9-]{1,40})\.(?:webp|avif)$/;

// Every card picture ships as WebP, and its small sizes also as AVIF
// (about a fifth smaller at better fidelity; scripts/lib/card-art-variants.mjs).
// <picture> lets the browser choose for what it draws. A preload made in
// script has no <picture>, so it has to ask for the format the page will
// pick, or the card is downloaded twice: this is that answer, found once by
// decoding a 1x1 AVIF. Until the probe has answered it is WebP, which every
// browser that runs the game decodes.
const AVIF_PROBE =
  'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB0AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAlbWRhdBIACgc4AAaQENBpMhAZQmMEwAA0AACQQM6Xt10S';
let avif = null;
let probing = null;

/**
 * Whether this browser decodes AVIF. Resolves once and caches; false
 * without an Image constructor (tests, a server).
 */
export const detectAvif = (Img = globalThis.Image) => {
  if (avif !== null) return Promise.resolve(avif);
  if (probing) return probing;
  if (typeof Img !== 'function') return Promise.resolve(false);
  probing = new Promise((resolve) => {
    const img = new Img();
    const done = (ok) => { avif = ok; probing = null; resolve(ok); };
    img.onload = () => done(img.width > 0);
    img.onerror = () => done(false);
    img.src = AVIF_PROBE;
  });
  return probing;
};

/** The format a script-made request for a small card picture should use. */
export const preferredArtFormat = () => (avif ? 'avif' : 'webp');

/** For tests: forget the probe's answer. */
export const resetArtFormatProbe = () => { avif = null; probing = null; };

/** The id as a filename stem, or null when it is not a card id. */
export const cardArtId = (id) => {
  if (typeof id === 'string' && SLUG.test(id)) return id;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return String(n);
};

/**
 * The thumb URL for a card id, or null when the id is not a card id. In the
 * format this browser's <picture> would choose, unless one is asked for.
 */
export const thumbUrl = (id, format = preferredArtFormat()) => {
  const safe = cardArtId(id);
  return safe ? `/cards/thumbs/${safe}.${format === 'avif' ? 'avif' : 'webp'}` : null;
};

/**
 * Every file for a card id, by size then format, or null when the id is not
 * a card id. The full plate is WebP only (an AVIF of it saved nothing at the
 * same fidelity).
 */
export const cardArtSources = (id) => {
  const safe = cardArtId(id);
  if (!safe) return null;
  return {
    thumb: { avif: `/cards/thumbs/${safe}.avif`, webp: `/cards/thumbs/${safe}.webp` },
    mid: { avif: `/cards/mid/${safe}.avif`, webp: `/cards/mid/${safe}.webp` },
    full: { webp: `/cards/${safe}.webp` },
  };
};

// The pixel widths of each size, for srcset.
export const ART_WIDTHS = { thumb: 192, mid: 480, full: 768 };

/** The full-plate URL for a card id, or null when the id is not a card id. */
export const fullArtUrl = (id) => {
  const safe = cardArtId(id);
  return safe ? `/cards/${safe}.webp` : null;
};

/**
 * Ask the browser to fetch each thumb. Deduped, and a no-op without
 * `document` (tests, a server). Returns the URLs it asked for.
 */
export const preloadCardThumbs = (ids, doc = globalThis.document) => {
  const urls = [];
  const seen = new Set();
  for (const id of ids || []) {
    const url = thumbUrl(id);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (!doc) continue;
    const img = doc.createElement('img');
    img.decoding = 'async';
    img.alt = '';
    img.src = url;
  }
  return urls;
};

export const isThumbUrl = (url) => THUMB.test(url);
