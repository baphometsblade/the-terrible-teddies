import React, { useState, useEffect, useCallback } from 'react';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { LastPlayedCard } from './LastPlayedCard';
import { GameLog } from './GameLog';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { CardEffects } from './CardEffects';
import { MomentumGauge } from './MomentumGauge';
import { PlayerHand } from './PlayerHand';
import { GameOverModal } from './GameOverModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLogic } from '../../hooks/useGameLogic';
import confetti from 'canvas-confetti';

export const GameBoard = ({ playerDeck, onExit }) => {
  const {
    playerHP,
    opponentHP,
    playerHand,
    opponentHand,
    currentTurn,
    momentumGauge,
    lastPlayedCard,
    gameLog,
    playCard,
    endTurn,
    isGameOver,
    winner,
  } = useGameLogic(playerDeck);

  const { toast } = useToast();

  const handlePlayCard = (card) => {
    if (currentTurn !== 'player') return;
    playCard(card);
  };

  const handleEndTurn = () => {
    if (currentTurn === 'player') {
      endTurn();
    }
  };

  const handlePlayAgain = () => {
    window.location.reload();
  };

  useEffect(() => {
    if (isGameOver && winner === 'player') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isGameOver, winner]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="game-board p-6 bg-gradient-to-b from-pink-100 to-purple-200 rounded-2xl shadow-2xl"
    >
      <OpponentArea hp={opponentHP} hand={opponentHand} />
      <GameInfo currentTurn={currentTurn} />
      <MomentumGauge value={momentumGauge} />
      <div className="flex mb-6 space-x-4">
        <LastPlayedCard card={lastPlayedCard} />
        <GameLog log={gameLog} />
      </div>
      <PlayerArea 
        hp={playerHP} 
        hand={playerHand} 
        onPlayCard={handlePlayCard} 
        currentTurn={currentTurn}
      />
      <PlayerHand hand={playerHand} onPlayCard={handlePlayCard} />
      <div className="mt-8 flex justify-center space-x-6">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button 
            onClick={handleEndTurn}
            disabled={currentTurn !== 'player'}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300"
          >
            End Turn
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button 
            onClick={onExit}
            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300"
          >
            Surrender
          </Button>
        </motion.div>
      </div>
      <AnimatePresence>
        {lastPlayedCard && (
          <CardEffects effect={lastPlayedCard.effect} type={lastPlayedCard.type} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isGameOver && (
          <GameOverModal 
            winner={winner} 
            onPlayAgain={handlePlayAgain} 
            onExit={onExit} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};