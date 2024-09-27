export class AIOpponent {
  constructor(difficulty = 'normal') {
    this.difficulty = difficulty;
  }

  chooseCard(hand, gameState) {
    const playableCards = hand.filter(card => card.energy_cost <= 10 - gameState.momentumGauge);
    if (playableCards.length === 0) return null;
    
    switch (this.difficulty) {
      case 'easy':
        return this.chooseRandomCard(playableCards);
      case 'normal':
        return this.chooseBalancedCard(playableCards, gameState);
      case 'hard':
        return this.chooseOptimalCard(playableCards, gameState);
      default:
        return this.chooseBalancedCard(playableCards, gameState);
    }
  }

  chooseRandomCard(cards) {
    return cards[Math.floor(Math.random() * cards.length)];
  }

  chooseBalancedCard(cards, gameState) {
    const sortedCards = cards.sort((a, b) => {
      const aScore = this.calculateCardScore(a, gameState);
      const bScore = this.calculateCardScore(b, gameState);
      return bScore - aScore;
    });
    return sortedCards[0];
  }

  chooseOptimalCard(cards, gameState) {
    // Implement more advanced logic for optimal card selection
    return this.chooseBalancedCard(cards, gameState);
  }

  calculateCardScore(card, gameState) {
    let score = card.energy_cost;
    if (gameState.playerHP < 10 && card.type === 'Action') score += 5;
    if (gameState.opponentHP < 10 && card.type === 'Special') score += 5;
    if (gameState.momentumGauge > 7 && card.type === 'Boost') score += 3;
    return score;
  }
}