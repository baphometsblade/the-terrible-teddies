export const drawCardFromDeck = (deck) => {
  if (deck.length === 0) {
    return { newDeck: [], drawnCard: null };
  }
  const drawnCard = deck[0];
  const newDeck = deck.slice(1);
  return { newDeck, drawnCard };
};

export const shuffleDeck = (cards) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};