import { PowerUp, TeddyCard } from '../types/types';

export const generatePowerUps = (): PowerUp[] => {
  return [
    {
      id: '1',
      name: 'Energy Boost',
      description: 'Gain 2 extra energy this turn',
      effect: (state) => ({ ...state, playerEnergy: state.playerEnergy + 2 }),
    },
    {
      id: '2',
      name: 'Healing Touch',
      description: 'Restore 5 health points',
      effect: (state) => ({ ...state, playerHealth: Math.min(state.playerHealth + 5, 30) }),
    },
    {
      id: '3',
      name: 'Card Draw',
      description: 'Draw 2 additional cards',
      effect: (state) => {
        const { updatedDeck, updatedHand } = state;
        const result1 = drawCard(updatedDeck, updatedHand);
        const result2 = drawCard(result1.updatedDeck, result1.updatedHand);
        return { ...state, deck: result2.updatedDeck, playerHand: result2.updatedHand };
      },
    },
  ];
};

export const applyPowerUp = (powerUp: PowerUp, gameState: any) => {
  return powerUp.effect(gameState);
};