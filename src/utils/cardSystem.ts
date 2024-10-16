import { TeddyCard } from '../types/types';
import { generateRandomTeddy } from './gameUtils';

export const drawCard = (deck: TeddyCard[], hand: TeddyCard[], maxHandSize: number = 7): { updatedDeck: TeddyCard[], updatedHand: TeddyCard[], drawnCard: TeddyCard | null } => {
  if (deck.length === 0 || hand.length >= maxHandSize) {
    return { updatedDeck: deck, updatedHand: hand, drawnCard: null };
  }

  const drawnCard = deck[0];
  const updatedDeck = deck.slice(1);
  const updatedHand = [...hand, drawnCard];

  return { updatedDeck, updatedHand, drawnCard };
};

export const discardCard = (card: TeddyCard, hand: TeddyCard[], discardPile: TeddyCard[]): { updatedHand: TeddyCard[], updatedDiscardPile: TeddyCard[] } => {
  const updatedHand = hand.filter(c => c.id !== card.id);
  const updatedDiscardPile = [...discardPile, card];

  return { updatedHand, updatedDiscardPile };
};

export const reshuffleDeck = (deck: TeddyCard[], discardPile: TeddyCard[]): TeddyCard[] => {
  const newDeck = [...deck, ...discardPile];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};