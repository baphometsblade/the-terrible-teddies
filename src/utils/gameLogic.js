import { teddyData } from '../data/teddyData';

export const initializeGame = () => {
  const shuffledTeddies = shuffleArray([...teddyData]);
  return {
    player: { hand: shuffledTeddies.slice(0, 5), hp: 30 },
    opponent: { hand: shuffledTeddies.slice(5, 10), hp: 30 },
    currentPlayer: 'player',
    momentumGauge: 0,
  };
};

export const playCard = (gameState, card, target) => {
  const currentPlayer = gameState.currentPlayer;
  const opponent = currentPlayer === 'player' ? 'opponent' : 'player';

  // Remove the card from the player's hand
  gameState[currentPlayer].hand = gameState[currentPlayer].hand.filter(c => c.id !== card.id);

  // Calculate damage
  let damage = Math.max(0, card.attack - target.defense);

  // Apply damage to opponent
  gameState[opponent].hp -= damage;

  // Apply special move effects
  applySpecialMove(gameState, card, currentPlayer);

  // Update momentum gauge
  gameState.momentumGauge = Math.min(10, gameState.momentumGauge + card.energy_cost);

  return gameState;
};

export const endTurn = (gameState) => {
  gameState.currentPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
  gameState.momentumGauge = 0;
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