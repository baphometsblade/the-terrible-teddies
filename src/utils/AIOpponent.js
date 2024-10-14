import { calculateDamage } from './battleUtils';

export const getAIAction = (aiTeddy, playerTeddy, battleState) => {
  const actions = ['attack', 'defend', 'special'];
  let weights = [0.6, 0.3, 0.1];

  // Adjust weights based on battle state
  if (battleState.opponentHealth < 30) {
    weights = [0.4, 0.4, 0.2]; // More defensive when low on health
  }

  if (battleState.opponentEnergy >= 2) {
    weights[2] += 0.2; // Increase chance of special move when energy is available
  }

  if (battleState.playerHealth < 20) {
    weights[0] += 0.2; // Increase chance of attack when player is low on health
  }

  // Consider combo potential
  const lastTwoMoves = battleState.opponentCombo.slice(-2);
  if (lastTwoMoves.length === 2 && lastTwoMoves[0] === lastTwoMoves[1]) {
    weights[actions.indexOf(lastTwoMoves[0])] += 0.1; // Slightly increase chance of continuing the combo
  }

  // Consider weather effects
  if (battleState.weatherEffect === 'Sunny') {
    weights[0] += 0.1; // Increase chance of attack in sunny weather
  } else if (battleState.weatherEffect === 'Rainy') {
    weights[1] += 0.1; // Increase chance of defend in rainy weather
  }

  // Make decision
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const randomValue = Math.random() * totalWeight;
  let cumulativeWeight = 0;

  for (let i = 0; i < actions.length; i++) {
    cumulativeWeight += weights[i];
    if (randomValue <= cumulativeWeight) {
      return actions[i];
    }
  }

  return 'attack'; // Fallback
};

export const performAIAction = (action, aiTeddy, playerTeddy, battleState) => {
  let newState = { ...battleState };
  let damage = 0;

  switch (action) {
    case 'attack':
      damage = calculateDamage(aiTeddy, playerTeddy, newState.weatherEffect);
      newState.playerHealth -= damage;
      newState.battleLog.push(`${aiTeddy.name} attacks for ${damage} damage!`);
      newState.opponentCombo.push('attack');
      break;
    case 'defend':
      newState.opponentEnergy += 1;
      newState.opponentDefenseBoost += Math.floor(aiTeddy.defense * 0.2);
      newState.battleLog.push(`${aiTeddy.name} defends and gains 1 energy and ${newState.opponentDefenseBoost} defense!`);
      newState.opponentCombo.push('defend');
      break;
    case 'special':
      if (newState.opponentEnergy >= 2) {
        const specialAbility = aiTeddy.specialAbility;
        const specialResult = specialAbility.effect(aiTeddy, playerTeddy, newState);
        newState = { ...newState, ...specialResult };
        newState.opponentEnergy -= 2;
        newState.opponentCombo.push('special');
      }
      break;
  }

  // Check for AI combo
  if (newState.opponentCombo.length >= 3) {
    const comboEffect = checkForCombo(newState.opponentCombo);
    if (comboEffect) {
      newState = applyComboEffect(newState, comboEffect, aiTeddy, playerTeddy);
    }
  }

  return newState;
};

const checkForCombo = (combo) => {
  const comboEffects = {
    'attack,attack,attack': { name: 'Triple Strike', effect: (damage) => damage * 1.5 },
    'defend,defend,defend': { name: 'Iron Wall', effect: (defense) => defense * 2 },
    'special,special,special': { name: 'Ultimate Power', effect: (damage) => damage * 2 },
    'attack,defend,special': { name: 'Balanced Assault', effect: (state) => ({ ...state, playerEnergy: state.playerEnergy + 2 }) },
  };
  return comboEffects[combo.join(',')];
};

const applyComboEffect = (state, comboEffect, attacker, defender) => {
  let newState = { ...state };
  if (comboEffect.name === 'Triple Strike' || comboEffect.name === 'Ultimate Power') {
    const damage = calculateDamage(attacker, defender, state.weatherEffect);
    newState.opponentHealth -= Math.floor(comboEffect.effect(damage));
  } else if (comboEffect.name === 'Iron Wall') {
    newState.opponentDefenseBoost = Math.floor(comboEffect.effect(newState.opponentDefenseBoost));
  } else if (comboEffect.name === 'Balanced Assault') {
    newState = comboEffect.effect(newState);
  }
  newState.battleLog.push(`${attacker.name} unleashes the ${comboEffect.name} combo!`);
  newState.opponentCombo = [];
  return newState;
};
