import { calculateDamage, rollForCritical } from './battleUtils';
import { applyStatusEffect, applyRageEffect } from './battleEffects';
import { checkForCombo, applyComboEffect } from './comboSystem';
import { applyWeatherEffect, getRandomWeatherEffect } from './weatherEffects';

export const performPlayerAction = (action, battleState, playerTeddyData, opponentTeddyData) => {
  let newState = { ...battleState };
  let damage = 0;

  const isCritical = rollForCritical(playerTeddyData, newState.playerCriticalChanceBoost);

  switch (action) {
    case 'attack':
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newState.weatherEffect, isCritical);
      newState.opponentHealth -= damage;
      newState.battleLog.push(`${playerTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`);
      newState.moveHistory.push('attack');
      newState.rage = Math.min(newState.rage + 10, 100);
      break;
    case 'defend':
      newState.playerEnergy += 1;
      newState.playerDefenseBoost += Math.floor(playerTeddyData.defense * 0.2);
      newState.battleLog.push(`${playerTeddyData.name} defends and gains 1 energy and ${newState.playerDefenseBoost} defense!`);
      newState.moveHistory.push('defend');
      newState.rage = Math.min(newState.rage + 5, 100);
      break;
    case 'special':
      if (newState.playerEnergy >= 2) {
        const specialAbility = playerTeddyData.specialAbility;
        const specialResult = specialAbility.effect(playerTeddyData, opponentTeddyData, newState);
        newState = { ...newState, ...specialResult };
        newState.playerEnergy -= 2;
        newState.moveHistory.push('special');
        newState.rage = Math.min(newState.rage + 15, 100);
      }
      break;
    case 'ultimate':
      if (newState.rage === 100) {
        damage = calculateDamage(playerTeddyData, opponentTeddyData, newState.weatherEffect, true) * 2;
        newState.opponentHealth -= damage;
        newState.battleLog.push(`${playerTeddyData.name} unleashes their Ultimate Move for ${damage} devastating damage!`);
        newState.rage = 0;
        newState = applyRageEffect(newState, playerTeddyData);
      }
      break;
  }

  newState.powerUpMeter = Math.min(newState.powerUpMeter + 10, 100);
  newState.comboMeter = Math.min(newState.comboMeter + 20, 100);
  newState.currentTurn = 'opponent';
  newState.roundCount++;

  newState = applyStatusEffect(newState, playerTeddyData, opponentTeddyData);
  newState = applyWeatherEffect(newState, newState.weatherEffect);

  // Change weather every 5 rounds
  if (newState.roundCount % 5 === 0) {
    const newWeatherEffect = getRandomWeatherEffect();
    newState.weatherEffect = newWeatherEffect;
    newState.battleLog.push(`The weather is changing to ${newWeatherEffect.name}!`);
  }

  const combo = checkForCombo(newState.moveHistory);
  if (combo) {
    newState = applyComboEffect(newState, combo, playerTeddyData, opponentTeddyData);
  }

  return newState;
};

export const performAIAction = (action, battleState, aiTeddyData, playerTeddyData) => {
  let newState = { ...battleState };
  let damage = 0;

  const isCritical = rollForCritical(aiTeddyData, newState.opponentCriticalChanceBoost);

  switch (action) {
    case 'attack':
      damage = calculateDamage(aiTeddyData, playerTeddyData, newState.weatherEffect, isCritical);
      newState.playerHealth -= damage;
      newState.battleLog.push(`${aiTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`);
      newState.moveHistory.push('attack');
      newState.aiRage = Math.min(newState.aiRage + 10, 100);
      break;
    case 'defend':
      newState.opponentEnergy += 1;
      newState.opponentDefenseBoost += Math.floor(aiTeddyData.defense * 0.2);
      newState.battleLog.push(`${aiTeddyData.name} defends and gains 1 energy and ${newState.opponentDefenseBoost} defense!`);
      newState.moveHistory.push('defend');
      newState.aiRage = Math.min(newState.aiRage + 5, 100);
      break;
    case 'special':
      if (newState.opponentEnergy >= 2) {
        const specialAbility = aiTeddyData.specialAbility;
        const specialResult = specialAbility.effect(aiTeddyData, playerTeddyData, newState);
        newState = { ...newState, ...specialResult };
        newState.opponentEnergy -= 2;
        newState.moveHistory.push('special');
        newState.aiRage = Math.min(newState.aiRage + 15, 100);
      }
      break;
    case 'ultimate':
      if (newState.aiRage === 100) {
        damage = calculateDamage(aiTeddyData, playerTeddyData, newState.weatherEffect, true) * 2;
        newState.playerHealth -= damage;
        newState.battleLog.push(`${aiTeddyData.name} unleashes their Ultimate Move for ${damage} devastating damage!`);
        newState.aiRage = 0;
        newState = applyRageEffect(newState, aiTeddyData);
      }
      break;
  }

  newState.currentTurn = 'player';
  newState.roundCount++;

  newState = applyStatusEffect(newState, aiTeddyData, playerTeddyData);
  newState = applyWeatherEffect(newState, newState.weatherEffect);

  const combo = checkForCombo(newState.moveHistory);
  if (combo) {
    newState = applyComboEffect(newState, combo, aiTeddyData, playerTeddyData);
  }

  return newState;
};
