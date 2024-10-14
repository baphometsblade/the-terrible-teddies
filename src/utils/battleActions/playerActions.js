import { calculateDamage, applyStatusEffect, rollForCritical } from '../battleUtils';
import { checkAchievements } from '../achievementSystem';

export const performPlayerAction = (action, battleState, playerTeddyData, opponentTeddyData, updatePlayerTeddyMutation, toast) => {
  let newBattleState = { ...battleState };
  let damage = 0;
  let logMessage = '';

  const isCritical = rollForCritical(playerTeddyData);

  switch (action) {
    case 'attack':
      ({ damage, logMessage } = handleAttack(newBattleState, playerTeddyData, opponentTeddyData, isCritical));
      break;
    case 'special':
      ({ damage, logMessage } = handleSpecialAttack(newBattleState, playerTeddyData, opponentTeddyData));
      break;
    case 'defend':
      ({ logMessage } = handleDefend(newBattleState, playerTeddyData));
      break;
    default:
      if (action.startsWith('use_item_')) {
        ({ logMessage } = handleUseItem(newBattleState, playerTeddyData, action));
      }
  }

  newBattleState = updateBattleState(newBattleState, damage, logMessage, playerTeddyData, opponentTeddyData);
  newBattleState = handleLevelUp(newBattleState, playerTeddyData, updatePlayerTeddyMutation, toast);

  return newBattleState;
};

const handleAttack = (battleState, attacker, defender, isCritical) => {
  const damage = calculateDamage(attacker, defender, battleState.opponentDefenseBoost, isCritical);
  let logMessage = '';

  if (battleState.opponentShield) {
    logMessage = `${defender.name}'s shield blocks the attack!`;
    battleState.opponentShield = false;
  } else {
    battleState.opponentHealth -= damage;
    logMessage = `${attacker.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
  }

  return { damage, logMessage };
};

const handleSpecialAttack = (battleState, attacker, defender) => {
  const damage = calculateDamage(attacker, defender, battleState.opponentDefenseBoost) * 1.5;
  let logMessage = '';

  if (battleState.opponentShield) {
    logMessage = `${defender.name}'s shield blocks the special attack!`;
    battleState.opponentShield = false;
  } else {
    battleState.opponentHealth -= damage;
    battleState.opponentStatusEffect = 'elemental';
    logMessage = `${attacker.name} uses ${attacker.special_move} for ${damage} damage and applies elemental effect!`;
  }

  return { damage, logMessage };
};

const handleDefend = (battleState, attacker) => {
  const defenseBoost = Math.floor(attacker.defense * 0.5);
  battleState.playerDefenseBoost += defenseBoost;
  const logMessage = `${attacker.name} increases defense by ${defenseBoost}!`;

  return { logMessage };
};

const handleUseItem = (battleState, attacker, action) => {
  const itemIndex = parseInt(action.split('_')[2]);
  const item = battleState.playerItems[itemIndex];
  battleState = item.effect(battleState, true);
  battleState.playerItems = battleState.playerItems.filter((_, index) => index !== itemIndex);
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
  battleState.currentTurn = 'opponent';
  battleState.roundCount++;

  return battleState;
};

const applyStatusEffects = (battleState, playerTeddyData, opponentTeddyData) => {
  if (battleState.playerStatusEffect) {
    const updatedPlayerTeddy = applyStatusEffect(playerTeddyData, battleState.playerStatusEffect);
    battleState.playerHealth = updatedPlayerTeddy.health;
    battleState.battleLog = [...battleState.battleLog, `${playerTeddyData.name} is affected by ${battleState.playerStatusEffect}!`];
  }
  if (battleState.opponentStatusEffect) {
    const updatedOpponentTeddy = applyStatusEffect(opponentTeddyData, battleState.opponentStatusEffect);
    battleState.opponentHealth = updatedOpponentTeddy.health;
    battleState.battleLog = [...battleState.battleLog, `${opponentTeddyData.name} is affected by ${battleState.opponentStatusEffect}!`];
  }
  return battleState;
};

const handleLevelUp = (battleState, playerTeddyData, updatePlayerTeddyMutation, toast) => {
  if (battleState.playerExperience >= battleState.playerLevel * 100) {
    battleState.playerLevel++;
    battleState.playerExperience -= (battleState.playerLevel - 1) * 100;
    toast({
      title: "Level Up!",
      description: `${playerTeddyData.name} has reached level ${battleState.playerLevel}!`,
    });
    
    const updatedTeddy = {
      ...playerTeddyData,
      attack: playerTeddyData.attack + 1,
      defense: playerTeddyData.defense + 1,
    };
    updatePlayerTeddyMutation.mutate(updatedTeddy);
  }
  return battleState;
};