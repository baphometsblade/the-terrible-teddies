import React, { useState, useEffect } from 'react';
import { PlayerHand } from './PlayerHand';
import { OpponentArea } from './OpponentArea';
import { BattleArena } from './BattleArena';
import { GameInfo } from './GameInfo';
import { initializeGame, playCard, endTurn, checkGameOver } from '../utils/gameLogic';
import { supabase } from '../lib/supabase';

export const GameBoard = () => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    const setupGame = async () => {
      const initialState = await initializeGame();
      setGameState(initialState);
    };
    setupGame();
  }, []);

  const handleCardPlay = async (card) => {
    if (!gameState) return;

    const updatedState = playCard(gameState, card);
    setGameState(updatedState);

    const gameOverCheck = checkGameOver(updatedState);
    if (gameOverCheck.gameOver) {
      console.log(`Game Over! Winner: ${gameOverCheck.winner}`);
      // Implement game over logic here
    } else {
      // AI opponent's turn
      const aiMove = await getAIMove(updatedState);
      const aiUpdatedState = playCard(updatedState, aiMove);
      setGameState(aiUpdatedState);
    }
  };

  const handleEndTurn = () => {
    if (!gameState) return;
    const updatedState = endTurn(gameState);
    setGameState(updatedState);
  };

  if (!gameState) return <div>Loading...</div>;

  return (
    <div className="game-board">
      <GameInfo currentPlayer={gameState.currentPlayer} turn={gameState.turn} />
      <OpponentArea opponent={gameState.opponent} />
      <BattleArena />
      <PlayerHand 
        hand={gameState.player.hand} 
        onCardSelect={setSelectedCard}
        onCardPlay={handleCardPlay}
      />
      <button onClick={handleEndTurn}>End Turn</button>
    </div>
  );
};

const getAIMove = async (gameState) => {
  // Implement AI logic here
  // For now, just return a random card from the AI's hand
  return gameState.opponent.hand[Math.floor(Math.random() * gameState.opponent.hand.length)];
};
