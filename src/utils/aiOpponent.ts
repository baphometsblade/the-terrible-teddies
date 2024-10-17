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

  // Play a card if possible
  if (playableCards.length > 0 && opponentField.length < 3) {
    // Choose the card with the highest attack or defense
    const bestCard = playableCards.reduce((prev, current) => 
      (current.attack + current.defense > prev.attack + prev.defense) ? current : prev
    );
    return { action: 'play', card: bestCard };
  }
  
  // Attack if possible
  if (opponentField.length > 0 && playerField.length > 0) {
    // Choose the attacker that can deal the most damage
    const bestAttacker = opponentField.reduce((prev, current) => {
      const prevDamage = calculateDamage(prev, playerField[0]);
      const currentDamage = calculateDamage(current, playerField[0]);
      return currentDamage > prevDamage ? current : prev;
    });
    return { action: 'attack', card: bestAttacker };
  }
  
  return { action: 'endTurn' };
};