const AIOpponent = {
  chooseAction: (aiTeddy, playerTeddy, battleState) => {
    const actions = ['attack', 'special', 'defend'];
    const weights = [
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
  }
};

export default AIOpponent;