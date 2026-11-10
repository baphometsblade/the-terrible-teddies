// Deck identity for the Deck Builder: two decks are the same deck when they
// hold the same cards the same number of times. Order does not count — the
// battle shuffles the deck before it deals — so taking a card out and putting
// it back is not a change.

const idRank = (id) => (typeof id === 'number' ? id : null);

/** A canonical string for a list of card ids: equal for equal decks. */
export const deckKey = (ids) => [...(ids ?? [])].sort((a, b) => {
  const na = idRank(a);
  const nb = idRank(b);
  if (na != null && nb != null) return na - nb;
  if (na != null) return -1;
  if (nb != null) return 1;
  return String(a).localeCompare(String(b));
}).join(',');

/** Whether two lists of card ids are the same deck. */
export const sameDeck = (a, b) => deckKey(a) === deckKey(b);
