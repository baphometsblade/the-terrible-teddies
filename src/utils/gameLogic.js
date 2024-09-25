import { supabase } from '../lib/supabase';

export const initializeGame = async () => {
  const { data: cards, error } = await supabase
    .from('terrible_teddies')
    .select('*')
    .limit(10);  // Fetch 10 cards for simplicity

  if (error) {
    console.error('Error fetching cards:', error);
    return null;
  }

  const shuffledCards = shuffleArray(cards);
  const playerHand = shuffledCards.slice(0, 5);
  const opponentHand = shuffledCards.slice(5, 10);

  return {
    player: { hand: playerHand, hp: 30 },
    opponent: { hand: opponentHand, hp: 30 },
    currentPlayer: 'player',
    turn: 1,
  };
};

export const playCard = (gameState, card) => {
  const currentPlayer = gameState.currentPlayer;
  const opponent = currentPlayer === 'player' ? 'opponent' : 'player';

  // Remove the card from the player's hand
  gameState[currentPlayer].hand = gameState[currentPlayer].hand.filter(c => c.id !== card.id);

  // Apply card effects
  gameState[opponent].hp -= card.attack;

  // Check for special move
  if (card.special_move) {
    applySpecialMove(gameState, card, currentPlayer);
  }

  return gameState;
};

export const endTurn = (gameState) => {
  gameState.currentPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
  gameState.turn += 1;
  return gameState;
};

export const checkGameOver = (gameState) => {
  if (gameState.player.hp <= 0) {
    return { gameOver: true, winner: 'opponent' };
  } else if (gameState.opponent.hp <= 0) {
    return { gameOver: true, winner: 'player' };
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

const applySpecialMove = (gameState, card, currentPlayer) => {
  const opponent = currentPlayer === 'player' ? 'opponent' : 'player';
  switch (card.special_move) {
    case 'On the Rocks':
      gameState[opponent].defense -= 2;
      break;
    case 'Sneak Kiss':
      gameState[opponent].skipNextTurn = true;
      break;
    // Add more special moves here
    default:
      break;
  }
};
