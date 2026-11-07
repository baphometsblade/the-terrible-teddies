// Start the pictures a fight is about to show, the moment the player sits
// down, so the first hand is not a row of empty frames. Thumbs only: the
// board draws those, and the full plates are several times the size.

const THUMB = /^\/cards\/thumbs\/(\d+)\.webp$/;

/** The thumb URL for a card id, or null when the id is not a card id. */
export const thumbUrl = (id) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return `/cards/thumbs/${n}.webp`;
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
