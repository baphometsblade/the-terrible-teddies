import { calculateDamage, applyStatusEffect, rollForCritical } from '../battleUtils';
import { getSpecialAbility, useSpecialAbility } from '../specialAbilities';

export const performAIAction = (action, battleState, playerTeddyData, opponentTeddyData) => {
  let newBattleState = { ...battleState };
  let damage = 0;
  let logMessage = '';

  const isCritical = rollForCritical(opponentTeddyData);

  switch (action) {
    case 'attack':
      ({ damage, logMessage } = handleAttack(newBattleState, opponentTeddyData, playerTeddyData, isCritical));
      break;
    case 'special':
      ({ damage, logMessage } = handleSpecialAttack(newBattleState, opponentTeddyData, playerTeddyData));
      break;
    case 'defend':
      ({ logMessage } = handleDefend(newBattleState, opponentTeddyData));
      break;
    default:
      if (action.startsWith('use_item_')) {
        ({ logMessage } = handleUseItem(newBattleState, opponentTeddyData, action));
      }
  }

  newBattleState = updateBattleState(newBattleState, damage, logMessage, playerTeddyData, opponentTeddyData);

  return newBattleState;
};

const handleAttack = (battleState, attacker, defender, isCritical) => {
  const damage = calculateDamage(attacker, defender, battleState.playerDefenseBoost, isCritical);
  let logMessage = '';

  if (battleState.playerShield) {
    logMessage = `${defender.name}'s shield blocks the attack!`;
    battleState.playerShield = false;
  } else {
    battleState.playerHealth -= damage;
    logMessage = `${attacker.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
  }

  return { damage, logMessage };
};

const handleSpecialAttack = (battleState, attacker, defender) => {
  const damage = calculateDamage(attacker, defender, battleState.playerDefenseBoost) * 1.5;
  let logMessage = '';

  if (battleState.playerShield) {
    logMessage = `${defender.name}'s shield blocks the special attack!`;
    battleState.playerShield = false;
  } else {
    battleState.playerHealth -= damage;
    battleState.playerStatusEffect = 'elemental';
    logMessage = `${attacker.name} uses ${attacker.special_move} for ${damage} damage and applies elemental effect!`;
  }

  return { damage, logMessage };
};

const handleDefend = (battleState, attacker) => {
  const defenseBoost = Math.floor(attacker.defense * 0.5);
  battleState.opponentDefenseBoost += defenseBoost;
  const logMessage = `${attacker.name} increases defense by ${defenseBoost}!`;

  return { logMessage };
};

const handleUseItem = (battleState, attacker, action) => {
  const itemIndex = parseInt(action.split('_')[2]);
  const item = battleState.opponentItems[itemIndex];
  battleState = item.effect(battleState, false);
  battleState.opponentItems = battleState.opponentItems.filter((_, index) => index !== itemIndex);
  const logMessage = `${attacker.name} uses ${item.name}. ${item.description}`;

  return { logMessage };
};

const updateBattleState = (battleState, damage, logMessage, playerTeddyData, opponentTeddyData) => {
  battleState.battleLog = [...battleState.battleLog, logMessage];
  battleState.moveHistory = [...battleState.moveHistory, action];
  battleState.powerUpMeter = Math.min(battleState.powerUpMeter + 10, 100);
  battleState.comboMeter = Math.min(battleState.comboMeter + 20, 100);

  battleState = applyStatusEffects(battleState, playerTeddyData, opponentTeddyData);
  battleState.playerExperience += Math.floor(damage / 2);
  battleState.currentTurn = 'player';
  battleState.roundCount++;

  return battleState;
};
