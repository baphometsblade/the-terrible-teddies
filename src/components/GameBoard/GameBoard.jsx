import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { useGeneratedImages, useUserDeck } from '../../integrations/supabase';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { GameLog } from './GameLog';
import { BattleArena } from './BattleArena';
import { CardEvolution } from '../CardEvolution';
import { GameOverScreen } from '../GameOverScreen';
import { AIOpponent } from '../../utils/AIOpponent';
import { applyCardEffect, checkGameOver } from '../../utils/gameLogic';

export const GameBoard = ({ onExit, gameMode = 'singlePlayer', difficulty = 'normal' }) => {
  const [gameState, setGameState] = useState({
    playerHP: 30,
    opponentHP: 30,
    playerTeddies: [],
    opponentTeddies: [],
    currentTurn: 'player',
    selectedTeddy: null,
    gameLog: [],
    momentumGauge: 0,
    isGameOver: false,
    winner: null,
  });

  const [showEvolution, setShowEvolution] = useState(false);
  const [aiOpponent] = useState(new AIOpponent(difficulty));

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
      momentumGauge: Math.min(prevState.momentumGauge + 1, 10),
    }));
  };

  const handleEvolution = (evolvedCard) => {
    setGameState(prevState => ({
      ...prevState,
      playerTeddies: prevState.playerTeddies.map(teddy => 
        teddy.id === evolvedCard.id ? evolvedCard : teddy
      ),
    }));
    setShowEvolution(false);
  };

  useEffect(() => {
    if (gameState.currentTurn === 'opponent' && gameMode === 'singlePlayer') {
      const aiCard = aiOpponent.chooseCard(gameState.opponentTeddies, gameState);
      if (aiCard) {
        setTimeout(() => {
          const newState = applyCardEffect(gameState, aiCard, 'player');
          setGameState(newState);
          endTurn();
        }, 1000);
      } else {
        endTurn();
      }
    }
  }, [gameState.currentTurn, gameMode]);

  useEffect(() => {
    const gameOverResult = checkGameOver(gameState);
    if (gameOverResult.isGameOver) {
      setGameState(prevState => ({
        ...prevState,
        isGameOver: true,
        winner: gameOverResult.winner,
      }));
    }
  }, [gameState.playerHP, gameState.opponentHP]);

  if (isLoadingTeddies) {
    return <div>Loading game...</div>;
  }

  if (gameState.isGameOver) {
    return (
      <GameOverScreen
        winner={gameState.winner}
        playerScore={30 - gameState.opponentHP}
        opponentScore={30 - gameState.playerHP}
        onPlayAgain={() => initializeGame()}
        onMainMenu={onExit}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="game-board p-4 bg-gradient-to-b from-red-100 to-purple-200 rounded-lg shadow-xl"
    >
      <OpponentArea teddies={gameState.opponentTeddies} hp={gameState.opponentHP} />
      <GameInfo currentTurn={gameState.currentTurn} momentumGauge={gameState.momentumGauge} />
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
      <div className="mt-4 flex justify-between">
        <Button onClick={endTurn} disabled={gameState.currentTurn !== 'player'}>
          End Turn
        </Button>
        <Button onClick={() => setShowEvolution(true)} className="bg-purple-500 hover:bg-purple-600">
          Evolve Teddy
        </Button>
      </div>
      <AnimatePresence>
        {showEvolution && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white p-4 rounded-lg"
            >
              <h2 className="text-2xl font-bold mb-4">Choose a Teddy to Evolve</h2>
              <div className="grid grid-cols-2 gap-4">
                {gameState.playerTeddies.map(teddy => (
                  <CardEvolution key={teddy.id} card={teddy} onEvolve={handleEvolution} />
                ))}
              </div>
              <Button onClick={() => setShowEvolution(false)} className="mt-4">Close</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
