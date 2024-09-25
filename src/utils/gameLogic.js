import { supabase } from '../lib/supabase';

export const initializeGame = async (player1Id, player2Id) => {
  const { data: cards, error } = await supabase
    .from('generated_images')
    .select('*')
    .limit(40);

  if (error) {
    console.error('Error fetching cards:', error);
    return null;
  }

  const shuffledCards = shuffleArray(cards);
  const player1Hand = shuffledCards.slice(0, 5);
  const player2Hand = shuffledCards.slice(5, 10);
  const drawPile = shuffledCards.slice(10);

  return {
    players: [
      { id: player1Id, hp: 30, hand: player1Hand, energy: 3 },
      { id: player2Id, hp: 30, hand: player2Hand, energy: 3 },
    ],
    drawPile,
    discardPile: [],
    currentTurn: 0,
    turnNumber: 1,
  };
};

export const playCard = (gameState, playerId, cardIndex) => {
  const playerIndex = gameState.players.findIndex(p => p.id === playerId);
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const player = gameState.players[playerIndex];
  const opponent = gameState.players[opponentIndex];
  const card = player.hand[cardIndex];

  if (player.energy < card.energy_cost) {
    return { error: 'Not enough energy to play this card' };
  }

  // Remove the card from the player's hand
  player.hand.splice(cardIndex, 1);
  player.energy -= card.energy_cost;

  // Apply card effects
  switch (card.type) {
    case 'Action':
      opponent.hp -= card.attack || 0;
      break;
    case 'Defense':
      player.hp += card.defense || 0;
      break;
    // Add more case statements for other card types
  }

  // Move the card to the discard pile
  gameState.discardPile.push(card);

  return { updatedGameState: gameState };
};

export const endTurn = (gameState) => {
  gameState.currentTurn = gameState.currentTurn === 0 ? 1 : 0;
  gameState.turnNumber++;

  const currentPlayer = gameState.players[gameState.currentTurn];
  currentPlayer.energy = Math.min(currentPlayer.energy + 1, 10);

  // Draw a card
  if (gameState.drawPile.length > 0) {
    const drawnCard = gameState.drawPile.pop();
    currentPlayer.hand.push(drawnCard);
  }

  return gameState;
};

export const checkGameOver = (gameState) => {
  const deadPlayer = gameState.players.find(player => player.hp <= 0);
  if (deadPlayer) {
    return { gameOver: true, winner: gameState.players.find(player => player.id !== deadPlayer.id) };
  }
  return { gameOver: false };
};

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};
