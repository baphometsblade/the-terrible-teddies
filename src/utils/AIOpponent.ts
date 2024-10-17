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
      const { isCritical, damage } = calculateCriticalHit(opponentTeddy, opponentTeddy.attack);
      newState.playerHealth = Math.max(0, newState.playerHealth - damage);
      newState.battleLog.push(`${opponentTeddy.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`);
      if (Math.random() < 0.2) {
        newState = addStatusEffect(newState, 'burn', 'player');
      }
      break;
    case 'defend':
      newState.opponentEnergy = Math.min(5, newState.opponentEnergy + 1);
      newState.opponentDefenseBoost = (newState.opponentDefenseBoost || 0) + 2;
      newState.battleLog.push(`${opponentTeddy.name} defends, gaining 1 energy and boosting defense by 2.`);
      break;
    case 'special':
      if (newState.opponentEnergy >= 2) {
        const specialDamage = opponentTeddy.attack * 1.5;
        newState.playerHealth = Math.max(0, newState.playerHealth - specialDamage);
        newState.opponentEnergy -= 2;
        newState.battleLog.push(`${opponentTeddy.name} uses a special move for ${specialDamage} damage!`);
        newState = addStatusEffect(newState, 'stun', 'player');
      }
      break;
    case 'stunned':
      newState.battleLog.push(`${opponentTeddy.name} is stunned and loses their turn!`);
      break;
  }

  newState.opponentEnergy = Math.min(5, newState.opponentEnergy + 1); // Energy regeneration
  newState.currentTurn = 'player';
  newState.roundCount++;

  return newState;
};