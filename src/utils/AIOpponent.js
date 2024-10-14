import { calculateDamage, rollForCritical } from './battleUtils';

const AIOpponent = {
  chooseAction: (aiTeddy, playerTeddy, battleState) => {
    const actions = ['attack', 'special', 'defend'];
    let weights = [
      battleState.opponentHealth > 50 ? 0.6 : 0.3,
      battleState.opponentHealth > 30 ? 0.3 : 0.5,
      battleState.opponentHealth < 30 ? 0.5 : 0.2
    ];
    
    // Adjust weights based on player's health
    if (battleState.playerHealth < 20) {
      weights[0] += 0.2; // Increase chance of attack when player is low on health
      weights[1] += 0.1; // Slightly increase chance of special move
    }

    // Adjust weights based on AI's defense boost
    if (battleState.opponentDefenseBoost < 10) {
      weights[2] += 0.2; // Increase chance of defend if defense boost is low
    }

    // Consider status effects
    if (battleState.opponentStatusEffect === 'burn' || battleState.opponentStatusEffect === 'poison') {
      weights[2] += 0.3; // Increase chance of defend if affected by damaging status
    }

    // Consider weather effects
    if (battleState.weatherEffect === 'Sunny') {
      weights[0] += 0.1; // Increase chance of attack in sunny weather
    } else if (battleState.weatherEffect === 'Rainy') {
      weights[2] += 0.1; // Increase chance of defend in rainy weather
    }

    // Consider combo potential
    if (battleState.aiComboMeter >= 80) {
      weights[1] += 0.2; // Increase chance of special move to potentially trigger combo
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const randomValue = Math.random() * totalWeight;
    let weightSum = 0;
    
    for (let i = 0; i < actions.length; i++) {
      weightSum += weights[i];
      if (randomValue <= weightSum) {
        return actions[i];
      }
    }
    
    return 'attack'; // Fallback
  },

  performAction: (action, aiTeddy, playerTeddy, battleState) => {
    let damage = 0;
    let defenseBoost = 0;
    let statusEffect = null;

    switch (action) {
      case 'attack':
        const isCritical = rollForCritical(aiTeddy);
        damage = calculateDamage(aiTeddy, playerTeddy, battleState.playerDefenseBoost, isCritical);
        if (Math.random() < 0.2) { // 20% chance to apply a status effect on attack
          statusEffect = ['burn', 'freeze', 'poison'][Math.floor(Math.random() * 3)];
        }
        break;
      case 'special':
        damage = calculateDamage(aiTeddy, playerTeddy, battleState.playerDefenseBoost) * 1.5;
        statusEffect = 'elemental';
        break;
      case 'defend':
        defenseBoost = Math.floor(aiTeddy.defense * 0.5);
        break;
    }

    return { damage, defenseBoost, statusEffect };
  }
};

export default AIOpponent;