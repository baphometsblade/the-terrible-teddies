import { COMBAT_CATALOG } from '../combat/catalog.js';
import { deckKey } from '../deck.js';
import { deckProblem } from '../social/ladder.js';

const KNOWN = new Set(COMBAT_CATALOG.map((card) => card.id));
const BY_ID = new Map(COMBAT_CATALOG.map((card) => [card.id, card]));

/** A sentence when the deck cannot be queued, or null when it can. */
export const knownDeck = (ids) => deckProblem(ids, KNOWN);

/** Catalog rows in deck order. Null when any id is not a real card. */
export const cardsFor = (ids) => {
  const cards = [];
  for (let i = 0; i < ids.length; i += 1) {
    const card = BY_ID.get(ids[i]);
    if (!card) return null;
    cards.push(card);
  }
  return cards;
};

/**
 * A cloud save, when there is one, must actually contain this deck.
 * No save on the account yet means the shape check is all the server can do.
 * Gems are not consulted.
 */
export const saveAllows = (save, ids) => {
  if (!save || typeof save !== 'object') return true;
  const owned = new Set(Array.isArray(save.ownedCards) ? save.ownedCards : []);
  for (let i = 0; i < ids.length; i += 1) {
    if (!owned.has(ids[i])) return false;
  }
  const key = deckKey(ids);
  const lists = [save.currentDeck];
  const saved = Array.isArray(save.savedDecks) ? save.savedDecks : [];
  for (let i = 0; i < saved.length; i += 1) lists.push(saved[i] && saved[i].cards);
  return lists.some((list) => Array.isArray(list) && deckKey(list) === key);
};
