// The collection book: five sets, one per rarity, each with a completion
// reward claimed once. The catalog is passed in so this stays free of the
// store (the store is what pays).

// Names and blurbs are the House, winking. The reward figures stay plain.
export const COLLECTION_SETS = Object.freeze([
  { id: 'common', name: 'The Easy Yes', blurb: 'They said yes before the drinks landed.', reward: Object.freeze({ coins: 250, packs: 0 }) },
  { id: 'uncommon', name: 'Second Dates', blurb: 'Back again. Nobody pretends to be surprised.', reward: Object.freeze({ coins: 400, packs: 1 }) },
  { id: 'rare', name: 'The Back Room', blurb: 'The door opens when they decide they like you.', reward: Object.freeze({ coins: 700, packs: 1 }) },
  { id: 'epic', name: 'Private Booking', blurb: 'Reservation only. The curtains do the rest.', reward: Object.freeze({ coins: 1000, packs: 2 }) },
  { id: 'legendary', name: 'The Owner’s Key', blurb: 'A key to the good room. Try not to lose it.', reward: Object.freeze({ coins: 2000, packs: 3 }) },
].map((row) => Object.freeze(row)));

const SET_IDS = new Set(COLLECTION_SETS.map((set) => set.id));

/** A saved claim list with anything that is not a real set dropped. */
export const normalizeClaimedSets = (raw) => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (typeof id === 'string' && SET_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
};

/**
 * One row per set: how many of its cards are owned, which are missing, and
 * whether the reward is waiting. `cards` is the live catalog.
 */
export const bookOf = (cards, ownedIds) => {
  const owned = new Set(ownedIds || []);
  return COLLECTION_SETS.map((set) => {
    const members = (cards || []).filter((card) => card.rarity === set.id);
    const missing = members.filter((card) => !owned.has(card.id));
    return {
      id: set.id,
      name: set.name,
      blurb: set.blurb,
      reward: set.reward,
      total: members.length,
      owned: members.length - missing.length,
      missing,
      complete: members.length > 0 && missing.length === 0,
    };
  });
};
