import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { initializeGame, playCard, endTurn, checkGameOver } from '../utils/gameLogic';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { Button } from "@/components/ui/button";

export const GameBoard = ({ player1Id, player2Id }) => {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    const setupGame = async () => {
      const initialState = await initializeGame(player1Id, player2Id);
      setGameState(initialState);
    };
    setupGame();
  }, [player1Id, player2Id]);

  const handleCardPlay = (cardIndex) => {
    if (!gameState) return;

    const result = playCard(gameState, player1Id, cardIndex);
    if (result.error) {
      console.error(result.error);
      return;
    }

    setGameState(result.updatedGameState);
    const gameOverCheck = checkGameOver(result.updatedGameState);
    if (gameOverCheck.gameOver) {
      console.log(`Game Over! Winner: ${gameOverCheck.winner.id}`);
      // Implement game over logic here
    }
  };

  const handleEndTurn = () => {
    if (!gameState) return;

    const updatedState = endTurn(gameState);
    setGameState(updatedState);
  };

  if (!gameState) return <div>Loading...</div>;

  const currentPlayer = gameState.players[gameState.currentTurn];
  const isPlayerTurn = currentPlayer.id === player1Id;

  return (
    <div className="game-board">
      <OpponentArea player={gameState.players[1]} />
      <div className="play-area">
        {/* Implement play area UI here */}
      </div>
      <PlayerArea 
        player={gameState.players[0]} 
        onCardSelect={setSelectedCard}
        onCardPlay={handleCardPlay}
        isPlayerTurn={isPlayerTurn}
      />
      <Button onClick={handleEndTurn} disabled={!isPlayerTurn}>
        End Turn
      </Button>
    </div>
  );
};
