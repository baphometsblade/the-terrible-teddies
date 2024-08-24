const initializeGame = useCallback(() => {
  console.log("Initializing game with cards:", allCards);
  if (!allCards || allCards.length === 0) return;

  const gameCards = allCards.map(card => ({
    ...card,
    attack: card.energy_cost * 2,
    defense: card.energy_cost,
    specialMove: card.prompt
  }));
  console.log("Transformed game cards:", gameCards);
  const shuffledCards = shuffleArray([...gameCards]);
  setPlayerDeck(shuffledCards.slice(0, 20));
  setOpponentDeck(shuffledCards.slice(20, 40));
  setPlayerHP(INITIAL_HP);
  setOpponentHP(INITIAL_HP);
  setPlayerEnergy(INITIAL_ENERGY);
  setOpponentEnergy(INITIAL_ENERGY);
  setMomentumGauge(0);
  setGameLog([]);
  setActiveEffects({ player: [], opponent: [] });
  setIsGameOver(false);
  setWinner(null);
  setCurrentTurn('player');
  dealInitialHands();
}, [allCards]);