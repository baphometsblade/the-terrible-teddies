// Stars are how many times a card was taken home again. Dupes still become
// coins at the door; the coins buy the star. Stars do not change a fight.

export const STAR_CAP = 3;
export const STAR_UNLOCK_CARDS = 8;

export const starCount = (stars, cardId) => {
  const n = Math.floor(Number(stars?.[String(cardId)]) || 0);
  return n >= 1 && n <= STAR_CAP ? n : 0;
};

export const starCost = (cardId, stars, coinsFor) => {
  const have = starCount(stars, cardId);
  if (have >= STAR_CAP) return null;
  return Math.max(1, Math.floor(Number(coinsFor(cardId)) || 0)) * (have + 1);
};

/** The owned card in the set with the fewest stars, still under the cap. */
export const nextStarTarget = (cards, ownedIds, stars, setId) => {
  const owned = new Set(ownedIds || []);
  const open = (cards || []).filter((card) => card.rarity === setId && owned.has(card.id) && starCount(stars, card.id) < STAR_CAP);
  open.sort((a, b) => starCount(stars, a.id) - starCount(stars, b.id) || a.id - b.id);
  return open[0] || null;
};

/** Every card of the rarity owned, and each of them starred at least once. */
export const starSetReady = (cards, ownedIds, stars, setId) => {
  const owned = new Set(ownedIds || []);
  const members = (cards || []).filter((card) => card.rarity === setId);
  if (!members.length || members.some((card) => !owned.has(card.id))) return false;
  return members.every((card) => starCount(stars, card.id) >= 1);
};

export const starringUnlocked = (ownedIds) => (ownedIds || []).length >= STAR_UNLOCK_CARDS;

const asId = (id) => {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** A saved star map: known cards, 1 to 3, string keys. */
export const normalizeStars = (raw, cardIds) => {
  const allowed = new Set(cardIds || []);
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    const id = asId(key);
    const stars = Math.floor(Number(value));
    if (id == null || !allowed.has(id)) continue;
    if (stars >= 1 && stars <= STAR_CAP) out[String(id)] = stars;
  }
  return out;
};
