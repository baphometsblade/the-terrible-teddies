// Turn a published list of card ids into the objects the board deals.
// A copy of each catalog card, no difficulty bumps: the ghost is the deck
// its owner saved, not a harder Chuck. Unknown ids are dropped. The caller
// refuses a list that comes back shorter than a real fight.
//
// The deck column is still an integer array. Named sets file through their
// own ladder ids (the registry). Morning After ids (`ma-1` … `ma-10`) file
// as 151–160, a gap no catalog id uses. A real catalog id always wins over
// an alias.

import { fromLadderId, toLadderId } from '@/data/cardRegistry';

const EXPANSION = /^([a-z]{2})-([1-9]\d*)$/;

/** Prefix → the integer just before `prefix-1`. ma-1 files as 151. */
export const GHOST_FILE = Object.freeze({ ma: 150 });

/** The integer a deck column can store, or null when this id cannot be filed. */
export const toGhostId = (id) => {
  const listed = toLadderId(id);
  if (listed !== id) return listed;
  if (typeof id === 'number' && Number.isInteger(id)) return id;
  if (typeof id === 'string' && /^[1-9]\d*$/.test(id)) return Number(id);
  const match = typeof id === 'string' ? EXPANSION.exec(id) : null;
  if (!match) return null;
  const base = GHOST_FILE[match[1]];
  const n = Number(match[2]);
  if (!base || n > 10) return null;
  return base + n;
};

/** The catalog id a filed integer stands for, or null when it is not an alias. */
export const fromGhostId = (id) => {
  const listed = fromLadderId(id);
  if (listed !== id) return listed;
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
      const alias = Number.isInteger(n) ? fromGhostId(n) : fromGhostId(raw);
      if (alias != null) card = byId.get(alias);
      if (!card && Number.isInteger(n)) card = byId.get(n);
    }
    if (!card) return;
    cards.push({ ...card, instanceId: `g-${card.id}-${idx}` });
  });
  return cards;
};
