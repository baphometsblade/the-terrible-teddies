import { TeddyCard, PowerUp, Combo } from '../types/types';

export const generateRandomTeddy = (): TeddyCard => {
  const names = ['Fluffy', 'Grumpy', 'Sneaky', 'Bouncy', 'Sleepy'];
  const randomName = names[Math.floor(Math.random() * names.length)];
  return {
    id: Date.now(),
    name: `${randomName} Teddy`,
    attack: Math.floor(Math.random() * 3) + 1,
    defense: Math.floor(Math.random() * 3) + 1,
    specialAbility: generateRandomSpecialAbility(),
    energyCost: Math.floor(Math.random() * 2) + 1,
  };
};

export const generateRandomSpecialAbility = () => {
  const abilities = [
    { name: 'Furry Fury', effect: 'Increase attack by 2 for 1 turn' },
    { name: 'Cuddle Shield', effect: 'Increase defense by 2 for 1 turn' },
    { name: 'Stuffing Surge', effect: 'Heal 3 HP' },
    { name: 'Button Eye Beam', effect: 'Deal 2 damage to a random enemy' },
  ];
  return abilities[Math.floor(Math.random() * abilities.length)];
};

export const applySpecialAbility = (
  teddy: TeddyCard,
  playerHealth: number,
  opponentHealth: number,
  playerField: TeddyCard[],
  opponentField: TeddyCard[]
) => {
  switch (teddy.specialAbility.name) {
    case 'Furry Fury':
      return { ...teddy, attack: teddy.attack + 2, abilityDuration: 1 };
    case 'Cuddle Shield':
      return { ...teddy, defense: teddy.defense + 2, abilityDuration: 1 };
    case 'Stuffing Surge':
      return { playerHealth: Math.min(playerHealth + 3, 30) };
    case 'Button Eye Beam':
      if (opponentField.length > 0) {
        const targetIndex = Math.floor(Math.random() * opponentField.length);
        opponentField[targetIndex] = {
          ...opponentField[targetIndex],
          defense: Math.max(0, opponentField[targetIndex].defense - 2),
        };
      } else {
        return { opponentHealth: Math.max(0, opponentHealth - 2) };
      }
      return { opponentField };
    default:
      return {};
  }
};

export const calculateDamage = (attacker: TeddyCard, defender: TeddyCard) => {
  return Math.max(0, attacker.attack - defender.defense);
};

export const generatePowerUps = (): PowerUp[] => {
  return [
    {
      id: '1',
      name: 'Energy Boost',
      description: 'Gain 2 extra energy this turn',
      effect: () => {/* Implement effect */},
    },
    {
      id: '2',
      name: 'Healing Touch',
      description: 'Restore 5 health points',
      effect: () => {/* Implement effect */},
    },
    {
      id: '3',
      name: 'Card Draw',
      description: 'Draw 2 additional cards',
      effect: () => {/* Implement effect */},
    },
  ];
};

export const generateCombos = (): Combo[] => {
  return [
    {
      id: '1',
      name: 'Double Trouble',
      description: 'Play two cards of the same type for increased effect',
      requiredCards: ['any', 'any'],
    },
    {
      id: '2',
      name: 'Elemental Fusion',
      description: 'Combine two different elemental cards for a powerful effect',
      requiredCards: ['fire', 'water'],
    },
    {
      id: '3',
      name: 'Triple Threat',
      description: 'Play three cards in a row for a devastating combo attack',
      requiredCards: ['any', 'any', 'any'],
    },
  ];
};

export const checkForAvailableCombos = (hand: TeddyCard[], field: TeddyCard[]): Combo[] => {
  const allCombos = generateCombos();
  return allCombos.filter(combo => {
    // Implement logic to check if the combo is available based on the hand and field
    // This is a placeholder implementation
    return Math.random() > 0.5;
  });
};

export const getAIMove = (
  opponentHand: TeddyCard[],
  opponentField: TeddyCard[],
  playerField: TeddyCard[],
  opponentEnergy: number
): { action: 'play' | 'attack', card: TeddyCard } | { action: 'endTurn' } => {
  // Simple AI logic: play a card if possible, then attack if possible, otherwise end turn
  const playableCards = opponentHand.filter(card => card.energyCost <= opponentEnergy);
  
  if (playableCards.length > 0 && opponentField.length < 3) {
    return { action: 'play', card: playableCards[0] };
  }
  
  if (opponentField.length > 0 && playerField.length > 0) {
    return { action: 'attack', card: opponentField[0] };
  }
  
  return { action: 'endTurn' };
};