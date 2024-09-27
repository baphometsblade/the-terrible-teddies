export class AIOpponent {
  constructor(difficulty = 'normal') {
    this.difficulty = difficulty;
  }

  chooseTeddy(hand) {
    // Simple AI: choose the teddy with the highest attack
    return hand.reduce((prev, current) => (prev.attack > current.attack) ? prev : current);
  }

  chooseAction(aiTeddy, playerTeddy, energy) {
    const actions = ['attack', 'defend'];
    if (energy >= 2) actions.push('special');

    switch (this.difficulty) {
      case 'easy':
        return this.chooseRandomAction(actions);
      case 'normal':
        return this.chooseBalancedAction(aiTeddy, playerTeddy, actions);
      case 'hard':
        return this.chooseOptimalAction(aiTeddy, playerTeddy, energy, actions);
      default:
        return this.chooseRandomAction(actions);
    }
  }

  chooseRandomAction(actions) {
    return actions[Math.floor(Math.random() * actions.length)];
  }

  chooseBalancedAction(aiTeddy, playerTeddy, actions) {
    if (aiTeddy.health < playerTeddy.health && actions.includes('special')) {
      return 'special';
    } else if (aiTeddy.defense < playerTeddy.attack) {
      return 'defend';
    } else {
      return 'attack';
    }
  }

  chooseOptimalAction(aiTeddy, playerTeddy, energy, actions) {
    // Implement more advanced logic for optimal action selection
    // This is a placeholder and should be expanded based on game balance and strategy
    if (energy >= 2 && actions.includes('special')) {
      return 'special';
    } else if (aiTeddy.attack > playerTeddy.defense) {
      return 'attack';
    } else {
      return 'defend';
    }
  }
}