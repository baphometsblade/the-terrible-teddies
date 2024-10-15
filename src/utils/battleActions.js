import { calculateDamage, rollForCritical } from './battleUtils';
import { applyStatusEffect } from './battleEffects';
import { checkForCombo, applyComboEffect } from './comboSystem';

export const performPlayerAction = (action, battleState, playerTeddyData, opponentTeddyData) => {
  let newState = { ...battleState };
  let damage = 0;

  const isCritical = rollForCritical(playerTeddyData);

  switch (action) {
    case 'attack':
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newState.weatherEffect, isCritical);
      newState.opponentHealth -= damage;
      newState.battleLog.push(`${playerTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`);
      newState.moveHistory.push('attack');
      break;
    case 'defend':
      newState.playerEnergy += 1;
      newState.playerDefenseBoost += Math.floor(playerTeddyData.defense * 0.2);
      newState.battleLog.push(`${playerTeddyData.name} defends and gains 1 energy and ${newState.playerDefenseBoost} defense!`);
      newState.moveHistory.push('defend');
      break;
    case 'special':
      if (newState.playerEnergy >= 2) {
        const specialAbility = playerTeddyData.specialAbility;
        const specialResult = specialAbility.effect(playerTeddyData, opponentTeddyData, newState);
        newState = { ...newState, ...specialResult };
        newState.playerEnergy -= 2;
        newState.moveHistory.push('special');
      }
      break;
  }

  newState.powerUpMeter = Math.min(newState.powerUpMeter + 10, 100);
  newState.comboMeter = Math.min(newState.comboMeter + 20, 100);
  newState.currentTurn = 'opponent';
  newState.roundCount++;

  newState = applyStatusEffect(newState, playerTeddyData, opponentTeddyData);

  const combo = checkForCombo(newState.moveHistory);
  if (combo) {
    newState = applyComboEffect(newState, combo, playerTeddyData, opponentTeddyData);
  }

  return newState;
};

export const performAIAction = (action, battleState, aiTeddyData, playerTeddyData) => {
  let newState = { ...battleState };
  let damage = 0;

  switch (action) {
    case 'attack':
      damage = calculateDamage(aiTeddyData, playerTeddyData, newState.weatherEffect);
      newState.playerHealth -= damage;
      newState.battleLog.push(`${aiTeddyData.name} attacks for ${damage} damage!`);
      newState.moveHistory.push('attack');
      break;
    case 'defend':
      newState.opponentEnergy += 1;
      newState.opponentDefenseBoost += Math.floor(aiTeddyData.defense * 0.2);
      newState.battleLog.push(`${aiTeddyData.name} defends and gains 1 energy and ${newState.opponentDefenseBoost} defense!`);
      newState.moveHistory.push('defend');
      break;
    case 'special':
      if (newState.opponentEnergy >= 2) {
        const specialAbility = aiTeddyData.specialAbility;
        const specialResult = specialAbility.effect(aiTeddyData, playerTeddyData, newState);
        newState = { ...newState, ...specialResult };
        newState.opponentEnergy -= 2;
        newState.moveHistory.push('special');
      }
      break;
  }

  newState.currentTurn = 'player';
  newState.roundCount++;

  newState = applyStatusEffect(newState, aiTeddyData, playerTeddyData);

  const combo = checkForCombo(newState.moveHistory);
  if (combo) {
    newState = applyComboEffect(newState, combo, aiTeddyData, playerTeddyData);
  }

  return newState;
};