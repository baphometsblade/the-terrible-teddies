import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { useGeneratedImages, useUserDeck } from '../../integrations/supabase';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { GameLog } from './GameLog';
import { BattleArena } from './BattleArena';
import { applyCardEffect, checkGameOver } from '../../utils/gameLogic';

export const GameBoard = ({ onExit }) => {
  const [gameState, setGameState] = useState({
    playerHP: 30,
    opponentHP: 30,
    playerTeddies: [],
    opponentTeddies: [],
    currentTurn: 'player',
    selectedTeddy: null,
    gameLog: [],
  });

  const { toast } = useToast();
  const { data: allTeddies, isLoading: isLoadingTeddies } = useGeneratedImages();
  const { data: userDeck } = useUserDeck();

  useEffect(() => {
    if (allTeddies && userDeck) {
      initializeGame();
    }
  }, [allTeddies, userDeck]);

  const initializeGame = () => {
    const playerTeddies = userDeck && userDeck.deck ? userDeck.deck : allTeddies.slice(0, 5);
    const opponentTeddies = allTeddies.slice(5, 10);
    setGameState(prevState => ({
      ...prevState,
      playerTeddies,
      opponentTeddies,
    }));
  };

  const handleTeddySelect = (teddy) => {
    if (gameState.currentTurn === 'player') {
      setGameState(prevState => ({ ...prevState, selectedTeddy: teddy }));
    }
  };

  const handleAttack = (target) => {
    if (gameState.selectedTeddy && gameState.currentTurn === 'player') {
      const newState = applyCardEffect(gameState, gameState.selectedTeddy, target);
      setGameState(newState);
      endTurn();
    }
  };

  const endTurn = () => {
    setGameState(prevState => ({
      ...prevState,
      currentTurn: prevState.currentTurn === 'player' ? 'opponent' : 'player',
      selectedTeddy: null,
    }));
  };

  useEffect(() => {
    const gameOverResult = checkGameOver(gameState);
    if (gameOverResult.isGameOver) {
      toast({
        title: "Game Over!",
        description: `${gameOverResult.winner === 'player' ? 'You win!' : 'You lose!'}`,
        duration: 5000,
      });
      setTimeout(onExit, 5000);
    }
  }, [gameState, onExit, toast]);

  if (isLoadingTeddies) {
    return <div>Loading game...</div>;
  }

  return (
    <div className="game-board p-4 bg-gradient-to-b from-red-100 to-purple-200 rounded-lg shadow-xl">
      <OpponentArea teddies={gameState.opponentTeddies} hp={gameState.opponentHP} />
      <GameInfo currentTurn={gameState.currentTurn} />
      <BattleArena
        playerTeddies={gameState.playerTeddies}
        opponentTeddies={gameState.opponentTeddies}
        selectedTeddy={gameState.selectedTeddy}
        onTeddySelect={handleTeddySelect}
        onAttack={handleAttack}
        currentTurn={gameState.currentTurn}
      />
      <PlayerArea teddies={gameState.playerTeddies} hp={gameState.playerHP} />
      <GameLog logs={gameState.gameLog} />
      <Button onClick={endTurn} disabled={gameState.currentTurn !== 'player'} className="mt-4">
        End Turn
      </Button>
    </div>
  );
};
