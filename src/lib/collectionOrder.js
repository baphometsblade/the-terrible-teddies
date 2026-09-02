// Entrance-stagger ordering for a grid that HIDES non-matching tiles instead of
// unmounting them (see TeddyCollection's grid comment for why it hides).
//
// The consequence of hiding is that a tile's position in the source list is not
// its position on screen. A stagger keyed to the source index therefore breaks
// under every filter but "all": with an "epic only" filter the first tile the
// player can see might be catalog #26, and `index * 0.02` capped at 0.5s puts
// it — and everything after it — at the cap. The cascade collapses into a blank
// grid that half a second later pops in all at once.
//
// Returns id -> ordinal among the MATCHING cards, so `size` is also the number
// of visible tiles and `has(id)` is the visibility test.
export const buildVisibleOrder = (cards, matches) => {
  const order = new Map();
  for (const card of cards) {
    if (matches(card)) order.set(card.id, order.size);
  }
  return order;
};

// Capped so a large collection doesn't push the last tile seconds into the
// future; the cap is why the ordinal has to be the visible one.
export const staggerDelay = (ordinal, step = 0.02, max = 0.5) =>
  Math.min((ordinal ?? 0) * step, max);
