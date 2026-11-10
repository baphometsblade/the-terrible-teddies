// Deck identity for the Deck Builder: two decks are the same deck when they
// hold the same cards the same number of times. Order does not count — the
// battle shuffles the deck before it deals — so taking a card out and putting
// it back is not a change.

/** A canonical string for a list of card ids: equal for equal decks. */
export const deckKey = (ids) => [...(ids ?? [])]
  .map((id) => (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)) ? Number(id) : String(id)))
  .sort((a, b) => (
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  ))
  .join(',');

/** Whether two lists of card ids are the same deck. */
export const sameDeck = (a, b) => deckKey(a) === deckKey(b);
