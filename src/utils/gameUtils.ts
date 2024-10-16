import { TeddyCard } from '../types/types';

export const generateRandomTeddy = (): TeddyCard => {
  const names = ['Fluffy', 'Grumpy', 'Sneaky', 'Bouncy', 'Sleepy'];
  const randomName = names[Math.floor(Math.random() * names.length)];
  return {
    id: Date.now(),
    name: `${randomName} Teddy`,
    attack: Math.floor(Math.random() * 3) + 1,
    defense: Math.floor(Math.random() * 3) + 1,
    specialAbility: generateRandomSpecialAbility(),
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