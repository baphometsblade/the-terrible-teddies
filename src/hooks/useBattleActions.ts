import { useState } from 'react';
import { TeddyCard } from '../types/types';
import { calculateDamage } from '../utils/battleUtils';

export const useBattleActions = () => {
  const [lastActionResult, setLastActionResult] = useState<{
    damage: number;
    energyCost: number;
    message: string;
  } | null>(null);

  const performAttack = (attacker: TeddyCard, defender: TeddyCard, energy: number) => {
    if (energy < 1) return null;
    const damage = calculateDamage(attacker, defender);
    setLastActionResult({
      damage,
      energyCost: 1,
      message: `${attacker.name} attacks for ${damage} damage!`
    });
    return lastActionResult;
  };

  const performDefend = (teddy: TeddyCard, energy: number) => {
    if (energy < 1) return null;
    setLastActionResult({
      damage: 0,
      energyCost: 1,
      message: `${teddy.name} takes a defensive stance!`
    });
    return lastActionResult;
  };

  const performSpecialMove = (attacker: TeddyCard, defender: TeddyCard, energy: number) => {
    if (energy < 2) return null;
    const damage = calculateDamage(attacker, defender) * 1.5;
    setLastActionResult({
      damage: Math.floor(damage),
      energyCost: 2,
      message: `${attacker.name} uses their special move for ${Math.floor(damage)} damage!`
    });
    return lastActionResult;
  };

  return {
    performAttack,
    performDefend,
    performSpecialMove,
  };
};