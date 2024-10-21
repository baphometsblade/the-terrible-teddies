import { TeddyCard, PowerUp, BattleState } from '../types/types';
import { calculateDamage } from '../utils/battleUtils';
import { applyWeatherEffect } from '../utils/weatherEffects';
import { applyPowerUp } from '../utils/powerUpSystem';

export const useBattleActions = (battleState: BattleState, updateBattleState: (state: Partial<BattleState>) => void) => {
  const performAttack = () => {
    if (battleState.playerEnergy < 1) return null;
    const damage = calculateDamage(battleState.playerTeddy, battleState.opponentTeddy);
    const weatherAdjustedDamage = applyWeatherEffect(damage, battleState.weatherEffect, 'attack');
    
    updateBattleState({
      opponentHealth: Math.max(0, battleState.opponentHealth - weatherAdjustedDamage),
      playerEnergy: battleState.playerEnergy - 1,
      battleLog: [...battleState.battleLog, `${battleState.playerTeddy.name} attacks for ${weatherAdjustedDamage} damage!`]
    });

    return {
      damage: weatherAdjustedDamage,
      energyCost: 1,
      message: `${battleState.playerTeddy.name} attacks for ${weatherAdjustedDamage} damage!`
    };
  };

  const performDefend = () => {
    if (battleState.playerEnergy < 1) return null;
    const defenseBoost = 2;
    
    updateBattleState({
      playerDefenseBoost: battleState.playerDefenseBoost + defenseBoost,
      playerEnergy: battleState.playerEnergy - 1,
      battleLog: [...battleState.battleLog, `${battleState.playerTeddy.name} takes a defensive stance, boosting defense by ${defenseBoost}!`]
    });

    return {
      damage: 0,
      energyCost: 1,
      message: `${battleState.playerTeddy.name} takes a defensive stance, boosting defense by ${defenseBoost}!`
    };
  };

  const performSpecialMove = () => {
    if (battleState.playerEnergy < 2) return null;
    const damage = calculateDamage(battleState.playerTeddy, battleState.opponentTeddy) * 1.5;
    const weatherAdjustedDamage = applyWeatherEffect(damage, battleState.weatherEffect, 'special');
    
    updateBattleState({
      opponentHealth: Math.max(0, battleState.opponentHealth - weatherAdjustedDamage),
      playerEnergy: battleState.playerEnergy - 2,
      battleLog: [...battleState.battleLog, `${battleState.playerTeddy.name} uses their special move for ${weatherAdjustedDamage} damage!`]
    });

    return {
      damage: weatherAdjustedDamage,
      energyCost: 2,
      message: `${battleState.playerTeddy.name} uses their special move for ${weatherAdjustedDamage} damage!`
    };
  };

  const usePowerUp = (powerUp: PowerUp) => {
    const newState = applyPowerUp(powerUp, battleState);
    updateBattleState(newState);

    return {
      message: `${battleState.playerTeddy.name} used ${powerUp.name}!`
    };
  };

  return {
    performAttack,
    performDefend,
    performSpecialMove,
    usePowerUp,
  };
};
