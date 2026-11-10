// One match for the collection and the deck builder. A blank query matches
// everything. The set id is the expansion (`chuck`), not the rarity.

export const cardMatchesQuery = (card, query) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [card?.name, card?.description, card?.ability, card?.effect, card?.rarity, card?.type, card?.set]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
};
