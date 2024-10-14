import { calculateDamage, applyStatusEffect, rollForCritical } from '../battleUtils';
import AIOpponent from '../AIOpponent';

export const performAIAction = (action, battleState, playerTeddyData, opponentTeddyData) => {
  let newBattleState = { ...battleState };
  let damage = 0;
  let logMessage = '';

  const isCritical = rollForCritical(opponentTeddyData);

  switch (action) {
    case 'attack':
      damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerDefenseBoost, isCritical);
      if (newBattleState.playerShield) {
        logMessage = `${playerTeddyData.name}'s shield blocks the attack!`;
        newBattleState.playerShield = false;
      } else {
        newBattleState.playerHealth -= damage;
        logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
      }
      break;
    case 'special':
      damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerDefenseBoost) * 1.5;
      if (newBattleState.playerShield) {
        logMessage = `${playerTeddyData.name}'s shield blocks the special attack!`;
        newBattleState.playerShield = false;
      } else {
        newBattleState.playerHealth -= damage;
        newBattleState.playerStatusEffect = 'elemental';
        logMessage = `${opponentTeddyData.name} uses ${opponentTeddyData.special_move} for ${damage} damage and applies elemental effect!`;
      }
      break;
    case 'defend':
      const defenseBoost = Math.floor(opponentTeddyData.defense * 0.5);
      newBattleState.opponentDefenseBoost += defenseBoost;
      logMessage = `${opponentTeddyData.name} increases defense by ${defenseBoost}!`;
      break;
    default:
      if (action.startsWith('use_item_')) {
        const itemIndex = parseInt(action.split('_')[2]);
        const item = newBattleState.opponentItems[itemIndex];
        newBattleState = item.effect(newBattleState, false);
        newBattleState.opponentItems = newBattleState.opponentItems.filter((_, index) => index !== itemIndex);
        logMessage = `${opponentTeddyData.name} uses ${item.name}. ${item.description}`;
      }
  }

  newBattleState.battleLog = [...newBattleState.battleLog, logMessage];
  newBattleState.currentTurn = 'player';

  return newBattleState;
};
