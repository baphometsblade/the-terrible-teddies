// Deck identity for the Deck Builder: two decks are the same deck when they
// hold the same cards the same number of times. Order does not count — the
// battle shuffles the deck before it deals — so taking a card out and putting
// it back is not a change.

/** A canonical string for a list of card ids: equal for equal decks. */
export const deckKey = (ids) => [...(ids ?? [])].sort((a, b) => a - b).join(',');

/** Whether two lists of card ids are the same deck. */
export const sameDeck = (a, b) => deckKey(a) === deckKey(b);
