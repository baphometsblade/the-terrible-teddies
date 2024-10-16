import { TeddyCard } from '../types/types';
import { calculateDamage } from './gameUtils';

export const getAIMove = (
  opponentHand: TeddyCard[],
  opponentField: TeddyCard[],
  playerField: TeddyCard[],
  opponentEnergy: number,
  opponentHealth: number,
  playerHealth: number
): { action: 'play' | 'attack' | 'useSpecial', card: TeddyCard } | { action: 'endTurn' } => {
  const playableCards = opponentHand.filter(card => card.energyCost <= opponentEnergy);
  
  // Defensive strategy when low on health
  if (opponentHealth < 10 && playableCards.some(card => card.defense > 2)) {
    const defensiveCard = playableCards.find(card => card.defense > 2);
    if (defensiveCard) {
      return { action: 'play', card: defensiveCard };
    }
  }

  // Offensive strategy when player is low on health
  if (playerHealth < 10 && opponentField.length > 0) {
    const strongestAttacker = opponentField.reduce((prev, current) => (prev.attack > current.attack) ? prev : current);
    return { action: 'attack', card: strongestAttacker };
  }

  // Use special ability if available and beneficial
  const cardWithSpecial = opponentField.find(card => card.specialAbility && opponentEnergy >= 2);
  if (cardWithSpecial) {
    return { action: 'useSpecial', card: cardWithSpecial };
  }

  // Default strategy
  if (playableCards.length > 0 && opponentField.length < 3) {
    return { action: 'play', card: playableCards[0] };
  }
  
  if (opponentField.length > 0 && playerField.length > 0) {
    return { action: 'attack', card: opponentField[0] };
  }
  
  return { action: 'endTurn' };
};