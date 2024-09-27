import React, { useState, useEffect } from 'react';
import { initializeGame, playCard, endTurn, checkGameOver } from '../utils/gameLogic';
import PlayerHand from './PlayerHand';
import OpponentArea from './OpponentArea';
import { Button } from "@/components/ui/button";

const GameBoard = ({ onExitGame }) => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    setGameState(initializeGame());
  }, []);

  const handleCardPlay = (card) => {
    if (gameState.currentPlayer === 'player' && gameState.momentumGauge + card.energy_cost <= 10) {
      const newState = playCard(gameState, card, gameState.opponent.hand[0]); // For simplicity, always target the first opponent card
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
    return (
      <div>
        <h2>{winner === 'player' ? 'You Win!' : 'You Lose!'}</h2>
        <Button onClick={onExitGame}>Back to Menu</Button>
      </div>
    );
  }

  return (
    <div className="game-board">
      <OpponentArea hp={gameState.opponent.hp} hand={gameState.opponent.hand} />
      <div className="player-area">
        <PlayerHand 
          hand={gameState.player.hand} 
          onCardPlay={handleCardPlay}
          momentumGauge={gameState.momentumGauge}
        />
        <div>HP: {gameState.player.hp}</div>
        <Button onClick={handleEndTurn}>End Turn</Button>
      </div>
      <Button onClick={onExitGame}>Exit Game</Button>
    </div>
  );
};

export default GameBoard;