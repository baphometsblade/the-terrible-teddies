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
import { SpecialMoveModal } from './SpecialMoveModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLogic } from '../../hooks/useGameLogic';
import { useTerribleTeddiesCards, useUserDeck } from '../../integrations/supabase';
import { LoadingSpinner } from '../LoadingSpinner';
import confetti from 'canvas-confetti';

export const GameBoard = ({ onExit }) => {
  const { data: allCards, isLoading: isLoadingCards } = useTerribleTeddiesCards();
  const { data: userDeck, isLoading: isLoadingDeck } = useUserDeck();
  const { toast } = useToast();
  const [showSpecialMoveModal, setShowSpecialMoveModal] = useState(false);

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
    initializeGame,
    useSpecialMove,
  } = useGameLogic();

  useEffect(() => {
    if (!isLoadingCards && !isLoadingDeck && allCards && userDeck) {
      initializeGame(userDeck.length > 0 ? userDeck : allCards.slice(0, 20));
    }
  }, [isLoadingCards, isLoadingDeck, allCards, userDeck, initializeGame]);

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

  const handleSpecialMove = () => {
    if (momentumGauge >= 10) {
      setShowSpecialMoveModal(true);
    } else {
      toast({
        title: "Not enough momentum",
        description: "You need 10 momentum to use a special move!",
        variant: "destructive",
      });
    }
  };

  const executeSpecialMove = (moveName) => {
    useSpecialMove(moveName);
    setShowSpecialMoveModal(false);
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

  if (isLoadingCards || isLoadingDeck) {
    return <LoadingSpinner />;
  }

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
            onClick={handleSpecialMove}
            disabled={currentTurn !== 'player' || momentumGauge < 10}
            className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300"
          >
            Special Move
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
          <CardEffects effect={lastPlayedCard.specialMove} type={lastPlayedCard.type} />
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
      <AnimatePresence>
        {showSpecialMoveModal && (
          <SpecialMoveModal 
            onClose={() => setShowSpecialMoveModal(false)}
            onSelectMove={executeSpecialMove}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GameBoard;