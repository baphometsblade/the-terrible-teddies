// Start the pictures a fight is about to show, the moment the player sits
// down, so the first hand is not a row of empty frames. Thumbs only: the
// board draws those, and the full plates are several times the size.

// A card id is a positive integer, or an expansion slug such as lo-velvet.
// Anything else (a path, a blank, a joke string) is not a file we will ask for.
const CARD_ID = /^(?:[1-9]\d*|[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*)$/i;
const THUMB = /^\/cards\/thumbs\/(?:[1-9]\d*|[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\.webp$/i;

/** The id as a filename stem, or null when it is not a card id. */
export const cardArtId = (id) => {
  if (typeof id === 'number') {
    if (!Number.isInteger(id) || id <= 0) return null;
    return String(id);
  }
  if (typeof id !== 'string' || !CARD_ID.test(id)) return null;
  return id;
};

/** The thumb URL for a card id, or null when the id is not a card id. */
export const thumbUrl = (id) => {
  const safe = cardArtId(id);
  return safe ? `/cards/thumbs/${safe}.webp` : null;
};

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
