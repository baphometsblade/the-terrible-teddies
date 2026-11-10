// Turn a published list of card ids into the objects the board deals.
// A copy of each catalog card, no difficulty bumps: the ghost is the deck
// its owner saved, not a harder Chuck. Unknown ids are dropped. The caller
// refuses a list that comes back shorter than a real fight.
//
// The deck column is still an integer array. Morning After ids (`ma-1` …
// `ma-10`) file as 151–160, a gap no catalog id uses, and come back as those
// numbers. A real catalog id always wins over that alias.

const EXPANSION = /^([a-z]{2})-([1-9]\d*)$/;

/** Prefix → the integer just before `prefix-1`. ma-1 files as 151. */
export const GHOST_FILE = Object.freeze({ ma: 150 });

/** The integer a deck column can store, or null when this id cannot be filed. */
export const toGhostId = (id) => {
  if (typeof id === 'number' && Number.isInteger(id)) return id;
  if (typeof id === 'string' && /^[1-9]\d*$/.test(id)) return Number(id);
  const match = typeof id === 'string' ? EXPANSION.exec(id) : null;
  if (!match) return null;
  const base = GHOST_FILE[match[1]];
  const n = Number(match[2]);
  if (!base || n > 10) return null;
  return base + n;
};

/** The expansion id a filed integer stands for, or null. */
export const fromGhostId = (id) => {
  const n = typeof id === 'number'
    ? id
    : (typeof id === 'string' && /^[1-9]\d*$/.test(id) ? Number(id) : NaN);
  if (!Number.isInteger(n)) return null;
  for (const [prefix, base] of Object.entries(GHOST_FILE)) {
    const local = n - base;
    if (local >= 1 && local <= 10) return `${prefix}-${local}`;
  }
  return null;
};

const numericId = (raw) => (
  typeof raw === 'number' || (typeof raw === 'string' && /^[1-9]\d*$/.test(raw))
    ? Number(raw)
    : NaN
);

/** @param {unknown[]} ids @param {{ id: number | string }[]} catalog */
export const cardsFromIds = (ids, catalog) => {
  if (!Array.isArray(ids) || !Array.isArray(catalog)) return [];
  const byId = new Map(catalog.map((card) => [card.id, card]));
  const cards = [];
  ids.forEach((raw, idx) => {
    let card = byId.get(raw);
    if (!card) {
      const n = numericId(raw);
      if (Number.isInteger(n)) {
        card = byId.get(n);
        if (!card) {
          const expansion = fromGhostId(n);
          if (expansion) card = byId.get(expansion);
        }
      }
    }
    if (!card) return;
    cards.push({ ...card, instanceId: `g-${card.id}-${idx}` });
  });
  return cards;
};
