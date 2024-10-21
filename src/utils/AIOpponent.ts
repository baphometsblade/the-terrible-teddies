import { BattleState, TeddyCard } from '../types/types';

export const getAIMove = (state: BattleState): { action: string; card?: TeddyCard; target?: TeddyCard } => {
  const { opponentField, opponentHand, opponentEnergy, playerField } = state;

  // Play a card if possible
  const playableCards = opponentHand.filter(card => card.energyCost <= opponentEnergy);
  if (playableCards.length > 0 && opponentField.length < 5) {
    const cardToPlay = playableCards.reduce((prev, current) => 
      (prev.attack + prev.defense > current.attack + current.defense) ? prev : current
    );
    return { action: 'play', card: cardToPlay };
  }

  // Use special ability if available
  const cardWithSpecial = opponentField.find(card => 
    card.specialAbility.energyCost <= opponentEnergy && 
    !state.opponentCooldowns[card.id]
  );
  if (cardWithSpecial) {
    return { action: 'useSpecial', card: cardWithSpecial };
  }

  // Attack if possible
  if (opponentField.length > 0 && playerField.length > 0) {
    const attacker = opponentField.reduce((prev, current) => 
      (prev.attack > current.attack) ? prev : current
    );
    const target = playerField.reduce((prev, current) => 
      (prev.defense < current.defense) ? prev : current
    );
    return { action: 'attack', card: attacker, target };
  }

  // End turn if no other action is possible
  return { action: 'endTurn' };
};