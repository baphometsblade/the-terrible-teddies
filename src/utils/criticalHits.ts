import { TeddyCard } from '../types/types';

export const calculateCriticalHit = (attacker: TeddyCard, baseDamage: number): { isCritical: boolean; damage: number } => {
  const criticalChance = 0.1; // 10% chance for a critical hit
  const isCritical = Math.random() < criticalChance;
  const damage = isCritical ? Math.floor(baseDamage * 1.5) : baseDamage;
  return { isCritical, damage };
};