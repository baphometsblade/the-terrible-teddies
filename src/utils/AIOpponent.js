export class AIOpponent {
  chooseCard(hand, gameState) {
    // Simple AI logic: choose the card with the highest energy cost that can be played
    const playableCards = hand.filter(card => card.energy_cost <= 10 - gameState.momentumGauge);
    if (playableCards.length === 0) return null;
    
    return playableCards.reduce((prev, current) => (prev.energy_cost > current.energy_cost) ? prev : current);
  }
}