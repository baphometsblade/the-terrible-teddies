// Turn a published list of card ids into the objects the board deals.
// A copy of each catalog card, no difficulty bumps: the ghost is the deck
// its owner saved, not a harder Chuck. Unknown ids are dropped. The caller
// refuses a list that comes back shorter than a real fight.

/** @param {unknown[]} ids @param {{ id: number }[]} catalog */
export const cardsFromIds = (ids, catalog) => {
  if (!Array.isArray(ids) || !Array.isArray(catalog)) return [];
  const byId = new Map(catalog.map((card) => [card.id, card]));
  const cards = [];
  ids.forEach((raw, idx) => {
    const id = typeof raw === 'number' ? raw : Number(raw);
    const card = byId.get(id);
    if (!card) return;
    cards.push({ ...card, instanceId: `g-${id}-${idx}` });
  });
  return cards;
};
