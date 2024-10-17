import { TeddyCard, BattleState } from '../types/types';
import { calculateCriticalHit } from './criticalHits';
import { addStatusEffect } from './statusEffects';

const evaluateGameState = (opponentTeddy: TeddyCard, playerTeddy: TeddyCard, battleState: BattleState): number => {
  const healthDifference = battleState.opponentHealth - battleState.playerHealth;
  const attackDifference = opponentTeddy.attack - playerTeddy.attack;
  const defenseDifference = opponentTeddy.defense - playerTeddy.defense;
  
  return healthDifference * 0.5 + attackDifference * 0.3 + defenseDifference * 0.2;
};

export const getAIAction = (opponentTeddy: TeddyCard, playerTeddy: TeddyCard, battleState: BattleState) => {
  const gameStateScore = evaluateGameState(opponentTeddy, playerTeddy, battleState);
  
  if (battleState.opponentStunned) {
    return 'stunned';
  }

  if (battleState.opponentRage === 100) {
    return 'ultimate';
  }

  if (battleState.opponentHealth < 30 && battleState.opponentItems.length > 0) {
    return 'use_item_0';
  }

  if (gameStateScore > 10) {
    return Math.random() < 0.7 ? 'attack' : 'special';
  } else if (gameStateScore < -10) {
    return Math.random() < 0.6 ? 'defend' : 'special';
  } else if (battleState.opponentEnergy >= 2 && Math.random() > 0.7) {
    return 'special';
  } else {
    const randomAction = Math.random();
    if (randomAction < 0.5) {
      return 'attack';
    } else if (randomAction < 0.8) {
      return 'defend';
    } else {
      return 'special';
    }
  }
};

export const performAIAction = (action: string, battleState: BattleState, opponentTeddy: TeddyCard, playerTeddy: TeddyCard): BattleState => {
  let newState = { ...battleState };

  switch (action) {
    case 'attack':
      const { isCritical, damage } = calculateCriticalHit(opponentTeddy, opponentTeddy.attack + newState.opponentAttackBoost);
      const weatherAdjustedDamage = damage * (1 + newState.weatherEffect.attackModifier);
      newState.playerHealth = Math.max(0, newState.playerHealth - weatherAdjustedDamage);
      newState.battleLog.push(`${opponentTeddy.name} attacks for ${weatherAdjustedDamage} damage!${isCritical ? ' Critical hit!' : ''}`);
      if (Math.random() < 0.2) {
        newState = addStatusEffect(newState, 'burn', 'player');
      }
      newState.opponentRage = Math.min(100, newState.opponentRage + 10);
      break;
    case 'defend':
      newState.opponentEnergy = Math.min(5, newState.opponentEnergy + 1 + newState.opponentEnergyRegen);
      newState.opponentDefenseBoost = (newState.opponentDefenseBoost || 0) + 2;
      newState.battleLog.push(`${opponentTeddy.name} defends, gaining ${1 + newState.opponentEnergyRegen} energy and boosting defense by 2.`);
      newState.opponentRage = Math.min(100, newState.opponentRage + 5);
      break;
    case 'special':
      if (newState.opponentEnergy >= 2) {
        const specialDamage = (opponentTeddy.attack + newState.opponentAttackBoost) * 1.5;
        newState.playerHealth = Math.max(0, newState.playerHealth - specialDamage);
        newState.opponentEnergy -= 2;
        newState.battleLog.push(`${opponentTeddy.name} uses a special move for ${specialDamage} damage!`);
        newState = addStatusEffect(newState, 'stun', 'player');
        newState.opponentRage = Math.min(100, newState.opponentRage + 15);
      }
      break;
    case 'ultimate':
      if (newState.opponentRage === 100) {
        const ultimateDamage = (opponentTeddy.attack + newState.opponentAttackBoost) * 3;
        newState.playerHealth = Math.max(0, newState.playerHealth - ultimateDamage);
        newState.battleLog.push(`${opponentTeddy.name} unleashes their ultimate move for ${ultimateDamage} devastating damage!`);
        newState.opponentRage = 0;
      }
      break;
    case 'use_item_0':
      if (newState.opponentItems.length > 0) {
        const item = newState.opponentItems[0];
        newState = item.effect(newState, false);
        newState.opponentItems = newState.opponentItems.slice(1);
      }
      break;
    case 'stunned':
      newState.battleLog.push(`${opponentTeddy.name} is stunned and loses their turn!`);
      break;
  }

  newState.opponentEnergy = Math.min(5, newState.opponentEnergy + 1 + newState.opponentEnergyRegen);
  newState.currentTurn = 'player';
  newState.roundCount++;

  return newState;
};