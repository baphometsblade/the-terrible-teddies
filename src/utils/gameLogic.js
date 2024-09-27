import { teddyData } from '../data/teddyData';

export const initializeGame = () => {
  const shuffledTeddies = shuffleArray([...teddyData]);
  return {
    player: { hand: shuffledTeddies.slice(0, 5), hp: 30 },
    opponent: { hand: shuffledTeddies.slice(5, 10), hp: 30 },
    currentPlayer: 'player',
  };
};

export const playCard = (gameState, attackingCard, defendingCard) => {
  const currentPlayer = gameState.currentPlayer;
  const opponent = currentPlayer === 'player' ? 'opponent' : 'player';

  // Remove the card from the player's hand
  gameState[currentPlayer].hand = gameState[currentPlayer].hand.filter(c => c.id !== attackingCard.id);

  // Calculate damage
  let damage = attackingCard.attack - defendingCard.defense;
  damage = Math.max(0, damage); // Ensure damage is not negative

  // Apply damage to opponent
  gameState[opponent].hp -= damage;

  // Apply special move effects
  applySpecialMove(gameState, attackingCard, currentPlayer);

  return gameState;
};

export const endTurn = (gameState) => {
  gameState.currentPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
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
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const applySpecialMove = (gameState, card, currentPlayer) => {
  const opponent = currentPlayer === 'player' ? 'opponent' : 'player';
  switch (card.specialMove) {
    case "On the Rocks":
      gameState[opponent].hand.forEach(c => c.defense = Math.max(0, c.defense - 2));
      break;
    case "Sneak Kiss":
      gameState[opponent].skipNextTurn = true;
      break;
    // Add more special move effects here
    default:
      break;
  }
};