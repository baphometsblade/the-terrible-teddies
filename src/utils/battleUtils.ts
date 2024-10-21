import { TeddyCard } from '../types/types';

export const calculateDamage = (attacker: TeddyCard, defender: TeddyCard): number => {
  const baseDamage = attacker.attack - defender.defense;
  const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
  return Math.max(1, Math.floor(baseDamage * randomFactor));
};