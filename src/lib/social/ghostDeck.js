// Turn a published list of card ids into the objects the board deals.
// A copy of each catalog card, no difficulty bumps: the ghost is the deck
// its owner saved, not a harder Chuck. Unknown ids are dropped. The caller
// refuses a list that comes back shorter than a real fight.

import { fromLadderId as fromHenDo } from '@/data/henDoHavoc';
import { fromLadderId as fromLastOrders } from '@/data/expansion-last-orders';

const fromLadderId = (id) => fromLastOrders(fromHenDo(id));

/** @param {unknown[]} ids @param {{ id: number | string }[]} catalog */
export const cardsFromIds = (ids, catalog) => {
  if (!Array.isArray(ids) || !Array.isArray(catalog)) return [];
  const byId = new Map(catalog.map((card) => [card.id, card]));
  const cards = [];
  ids.forEach((raw, idx) => {
    const numeric = typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw));
    const id = fromLadderId(numeric ? Number(raw) : raw);
    const card = byId.get(id);
    if (!card) return;
    cards.push({ ...card, instanceId: `g-${id}-${idx}` });
  });
  return cards;
};
