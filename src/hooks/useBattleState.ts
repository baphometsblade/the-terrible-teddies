import { useState } from 'react';
import { BattleState } from '../types/types';
import { getRandomWeather } from '../utils/weatherEffects';
import { getRandomBattleItem } from '../utils/battleItems';

export const useBattleState = (initialPlayerHealth = 100, initialOpponentHealth = 100) => {
  const [battleState, setBattleState] = useState<BattleState>({
    playerHealth: initialPlayerHealth,
    opponentHealth: initialOpponentHealth,
    playerEnergy: 3,
    opponentEnergy: 3,
    playerDefenseBoost: 0,
    opponentDefenseBoost: 0,
    playerStatusEffects: [],
    opponentStatusEffects: [],
    currentTurn: 'player',
    roundCount: 0,
    playerExperience: 0,
    playerLevel: 1,
    weatherEffect: getRandomWeather(),
    comboMeter: 0,
    powerUpMeter: 0,
    battleLog: [],
    moveHistory: [],
    playerItems: [getRandomBattleItem(), getRandomBattleItem()],
    opponentItems: [getRandomBattleItem()],
    playerAttackBoost: 0,
    playerAttackBoostDuration: 0,
    opponentAttackBoost: 0,
    opponentAttackBoostDuration: 0,
    playerShield: false,
    opponentShield: false,
    rage: 0,
    aiRage: 0,
    playerCriticalChanceBoost: 0,
    opponentCriticalChanceBoost: 0,
  });

  const updateBattleState = (updates: Partial<BattleState>) => {
    setBattleState((prevState) => ({ ...prevState, ...updates }));
  };

  return [battleState, updateBattleState] as const;
};