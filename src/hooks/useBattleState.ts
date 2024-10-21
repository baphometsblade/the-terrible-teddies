import { useState } from 'react';
import { TeddyCard, BattleState, WeatherEffect } from '../types/types';
import { getRandomWeather } from '../utils/weatherEffects';
import { generatePowerUps } from '../utils/powerUpSystem';

export const useBattleState = (playerTeddy: TeddyCard, opponentTeddy: TeddyCard) => {
  const [battleState, setBattleState] = useState<BattleState>({
    playerTeddy,
    opponentTeddy,
    playerHealth: 20,
    opponentHealth: 20,
    playerEnergy: 3,
    opponentEnergy: 3,
    playerDefenseBoost: 0,
    opponentDefenseBoost: 0,
    currentTurn: 'player',
    weatherEffect: getRandomWeather(),
    availablePowerUps: generatePowerUps(3),
    battleLog: ['Battle started!'],
  });

  const updateBattleState = (updates: Partial<BattleState>) => {
    setBattleState((prevState) => ({ ...prevState, ...updates }));
  };

  return [battleState, updateBattleState] as const;
};
