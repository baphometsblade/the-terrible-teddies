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

export const GameBoard = ({ onExit }) => {
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
  } = useGameLogic('singlePlayer');

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
    // Reset game state
    window.location.reload();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="game-board p-4 bg-gradient-to-b from-pink-100 to-purple-200 rounded-lg shadow-xl"
    >
      <OpponentArea hp={opponentHP} hand={opponentHand} />
      <GameInfo currentTurn={currentTurn} />
      <MomentumGauge value={momentumGauge} />
      <div className="flex mb-6">
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
      <div className="mt-6 flex justify-center space-x-4">
        <Button 
          onClick={handleEndTurn}
          disabled={currentTurn !== 'player'}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          End Turn
        </Button>
        <Button 
          onClick={onExit}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          Surrender
        </Button>
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