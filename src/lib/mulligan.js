// The opening-hand mulligan. Once, before turn 1: the cards you throw back
// go into the deck, the deck is shuffled, and you draw that many. Chuck does
// the same with the cards behind his opener, and he throws back anything
// that costs more than 4. He cannot afford to sit on them.

export const MULLIGAN_MAX_COST = 4;
export const MULLIGAN_LOOK = 5;

export const mulliganKeptLine = () => 'You kept the hand.';
export const mulliganSwapLine = (n) => `Threw ${n} back. Drew ${n}.`;
export const mulliganOpponentLine = (name, n) => `${name} threw back ${n} that cost too much.`;

export const shuffleWith = (cards, random = Math.random) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * `tossIds` is the set of instance ids leaving the hand. An empty set is
 * "keep": the hand and the deck come back unchanged.
 */
export const applyMulligan = (hand, deck, tossIds, random = Math.random) => {
  const toss = hand.filter((card) => tossIds.has(card.instanceId));
  if (toss.length === 0) return { hand, deck, drawn: 0 };
  const keep = hand.filter((card) => !tossIds.has(card.instanceId));
  const pile = shuffleWith([...deck, ...toss], random);
  return {
    hand: [...keep, ...pile.slice(0, toss.length)],
    deck: pile.slice(toss.length),
    drawn: toss.length,
  };
};

/**
 * Chuck's deck after his opener has already been set on the table. He looks
 * at the first `look` cards, throws back the ones that cost more than
 * `maxCost`, and draws that many back off the top of the shuffled rest.
 */
export const mulliganOpponentDeck = (
  deck,
  { maxCost = MULLIGAN_MAX_COST, look = MULLIGAN_LOOK, random = Math.random } = {},
) => {
  const window = deck.slice(0, look);
  const rest = deck.slice(look);
  const toss = window.filter((card) => (card.cost ?? 0) > maxCost);
  if (toss.length === 0) return { deck, tossed: 0 };
  const keep = window.filter((card) => (card.cost ?? 0) <= maxCost);
  const pile = shuffleWith([...rest, ...toss], random);
  return { deck: [...keep, ...pile], tossed: toss.length };
};
