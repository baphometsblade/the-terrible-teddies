// What a player may field. Evergreen cards are always in the pool. A card
// named on a season is in the pool only while that window is open. Ownership
// is separate: a closed season stays unfieldable even if they own the card.
// Pack rolls use the same window in pack_card_in_pool.

function keysOf(card) {
  const id = card && typeof card === 'object' ? card.id : card;
  const filed = card && typeof card === 'object' ? card.filed : null;
  return [id, filed].filter((value) => value != null).map((value) => String(value));
}

function owns(owned, card) {
  const have = new Set((owned || []).map((id) => String(id)));
  return keysOf(card).some((key) => have.has(key));
}

function windowOpen(season, now) {
  const start = Date.parse(season?.starts_at);
  const end = Date.parse(season?.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const t = now.getTime();
  return t >= start && t < end;
}

/** True when the card is in the current pool, and owned when that is required. */
export function isCardAvailable(card, { owned, seasons, now = new Date(), requireOwned = true } = {}) {
  if (card == null) return false;
  if (requireOwned && !owns(owned, card)) return false;
  const keys = new Set(keysOf(card));
  const hits = (seasons || []).filter((season) => (
    (season.card_ids || []).some((id) => keys.has(String(id)))
  ));
  if (hits.length === 0) return true;
  return hits.some((season) => windowOpen(season, now));
}

/** The cards from a list that can be fielded under the same rule. */
export function collectiblePool(cards, ctx) {
  return (cards || []).filter((card) => isCardAvailable(card, ctx));
}

/** A sentence when a deck cannot be fielded, or null when it can. */
export function fieldingProblem(cards, ctx) {
  if (!cards || cards.some((card) => !isCardAvailable(card, ctx))) {
    return 'That deck has a card you cannot field.';
  }
  return null;
}
