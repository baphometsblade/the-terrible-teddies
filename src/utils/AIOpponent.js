import { calculateDamage } from './battleUtils';

class AIOpponent {
  static generateTeddy() {
    // This is a placeholder. In a real implementation, you'd fetch a random teddy from the database.
    return {
      id: 'ai-teddy-1',
      name: 'AI Teddy',
      attack: Math.floor(Math.random() * 5) + 3,
      defense: Math.floor(Math.random() * 5) + 3,
      specialMove: 'AI Special',
    };
  }

  static chooseAction(aiTeddy, playerTeddy, difficulty = 'medium') {
    const actions = ['attack', 'defend', 'special'];
    let weights;

    switch (difficulty) {
      case 'easy':
        weights = [0.6, 0.3, 0.1];
        break;
      case 'hard':
        weights = this.calculateHardDifficultyWeights(aiTeddy, playerTeddy);
        break;
      case 'medium':
      default:
        weights = [0.4, 0.3, 0.3];
        break;
    }

    return this.weightedRandomChoice(actions, weights);
  }

  static calculateHardDifficultyWeights(aiTeddy, playerTeddy) {
    const potentialDamage = calculateDamage(aiTeddy, playerTeddy);
    const defensiveNeed = calculateDamage(playerTeddy, aiTeddy) / aiTeddy.defense;

    let attackWeight = 0.4 + (potentialDamage / 10);
    let defendWeight = 0.3 + (defensiveNeed / 5);
    let specialWeight = 0.3;

    // Normalize weights
    const totalWeight = attackWeight + defendWeight + specialWeight;
    return [
      attackWeight / totalWeight,
      defendWeight / totalWeight,
      specialWeight / totalWeight
    ];
  }

  static weightedRandomChoice(items, weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      if (random < weights[i]) {
        return items[i];
      }
      random -= weights[i];
    }
    
    return items[items.length - 1];
  }
}

export default AIOpponent;