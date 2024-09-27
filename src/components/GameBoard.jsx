import React from 'react';
import PlayerArea from './PlayerArea';
import BattleArena from './BattleArena';
import GameOverScreen from './GameOverScreen';
import { initializeGame, playCard, endTurn, checkGameOver } from '../utils/gameLogic';

const GameBoard = ({ onExitGame }) => {
  const [gameState, setGameState] = React.useState(null);
  const [selectedCard, setSelectedCard] = React.useState(null);

  React.useEffect(() => {
    setGameState(initializeGame());
  }, []);

  const handleCardPlay = (card) => {
    if (gameState.currentPlayer === 'player' && !selectedCard) {
      setSelectedCard(card);
    } else if (gameState.currentPlayer === 'player' && selectedCard) {
      const newState = playCard(gameState, selectedCard, card);
      setGameState(newState);
      setSelectedCard(null);
    }
  };

  const handleEndTurn = () => {
    const newState = endTurn(gameState);
    setGameState(newState);
  };

  if (!gameState) return <div>Loading...</div>;

  const { gameOver, winner } = checkGameOver(gameState);

  if (gameOver) {
    return <GameOverScreen winner={winner} onPlayAgain={() => setGameState(initializeGame())} />;
  }

  return (
    <div className="game-board">
      <PlayerArea
        player={gameState.opponent}
        isOpponent={true}
        onCardPlay={handleCardPlay}
      />
      <BattleArena
        currentPlayer={gameState.currentPlayer}
        selectedCard={selectedCard}
      />
      <PlayerArea
        player={gameState.player}
        isOpponent={false}
        onCardPlay={handleCardPlay}
      />
      <button onClick={handleEndTurn}>End Turn</button>
      <button onClick={onExitGame}>Exit Game</button>
    </div>
  );
};

export default GameBoard;