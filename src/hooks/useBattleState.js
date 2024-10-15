import { useState } from 'react';
import { getRandomBattleItem } from '../utils/battleItems';

export const useBattleState = (initialPlayerHealth = 100, initialOpponentHealth = 100) => {
  const [battleState, setBattleState] = useState({
    playerHealth: initialPlayerHealth,
    opponentHealth: initialOpponentHealth,
    playerEnergy: 3,
    opponentEnergy: 3,
    playerDefenseBoost: 0,
    opponentDefenseBoost: 0,
    playerStatusEffect: null,
    opponentStatusEffect: null,
    currentTurn: 'player',
    roundCount: 0,
    playerExperience: 0,
    playerLevel: 1,
    weatherEffect: null,
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
  });

  const updateBattleState = (updates) => {
    setBattleState((prevState) => ({ ...prevState, ...updates }));
  };

  return [battleState, updateBattleState];
};