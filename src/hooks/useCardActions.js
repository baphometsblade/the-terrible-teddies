import { drawCardFromDeck, shuffleDeck } from '../utils/deckUtils';

export const useCardActions = (battleState, updateBattleState) => {
  const drawCard = () => {
    if (battleState.playerHand.length < 7) {
      const { newDeck, drawnCard } = drawCardFromDeck(battleState.playerDeck);
      if (drawnCard) {
        updateBattleState({
          ...battleState,
          playerDeck: newDeck,
          playerHand: [...battleState.playerHand, drawnCard],
          battleLog: [...battleState.battleLog, `You drew ${drawnCard.name}`],
        });
      } else {
        // If deck is empty, shuffle discard pile into deck
        const newDeck = shuffleDeck([...battleState.playerDiscardPile]);
        updateBattleState({
          ...battleState,
          playerDeck: newDeck,
          playerDiscardPile: [],
          battleLog: [...battleState.battleLog, "Deck reshuffled"],
        });
      }
    }
  };

  const playCard = (card) => {
    if (battleState.playerEnergy >= card.energyCost) {
      updateBattleState({
        ...battleState,
        playerHand: battleState.playerHand.filter(c => c.id !== card.id),
        playerField: [...battleState.playerField, card],
        playerEnergy: battleState.playerEnergy - card.energyCost,
        battleLog: [...battleState.battleLog, `You played ${card.name}`],
      });
    }
  };

  const endTurn = () => {
    updateBattleState({
      ...battleState,
      currentTurn: 'opponent',
      playerEnergy: battleState.playerEnergy + 1, // Gain 1 energy each turn
      roundCount: battleState.roundCount + 1,
    });
  };

  return { drawCard, playCard, endTurn };
};