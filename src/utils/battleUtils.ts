import { TeddyCard } from '../types/types';

export const calculateDamage = (attacker: TeddyCard, defender: TeddyCard): number => {
  const baseDamage = attacker.attack;
  const defense = defender.defense;
  const variance = Math.random() * 0.2 - 0.1; // -10% to +10% random variance
  
  // Calculate damage with defense reduction and variance
  const damage = Math.max(1, Math.round(baseDamage * (1 - defense / 20) * (1 + variance)));
  
  return damage;
};