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