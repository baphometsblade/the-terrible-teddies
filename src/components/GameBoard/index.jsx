import React, { useState, useEffect } from 'react';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { LastPlayedCard } from './LastPlayedCard';
import { GameLog } from './GameLog';
import { Button } from '@/components/ui/button';
import { useGameLogic } from '../../hooks/useGameLogic';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import confetti from 'canvas-confetti';

export const GameBoard = ({ gameMode, onExit, challengeRules }) => {
  const {
    playerHP, opponentHP, playerHand, opponentHand, currentTurn,
    momentumGauge, lastPlayedCard, gameLog, playCard, endTurn,
    playerDeck, opponentDeck, isGameOver, winner
  } = useGameLogic(gameMode);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isGameOver) {
      toast({
        title: "Game Over!",
        description: `${winner === 'player' ? 'You win!' : 'You lose!'}`,
        duration: 5000,
      });
      if (winner === 'player') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [isGameOver, winner, toast]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="game-board p-4 bg-gradient-to-b from-pink-100 to-purple-200 rounded-lg shadow-xl"
    >
      {challengeRules && (
        <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded-md">
          <h3 className="text-lg font-semibold text-yellow-800">Challenge Rules:</h3>
          <p className="text-yellow-700">{challengeRules}</p>
        </div>
      )}
      <OpponentArea hp={opponentHP} hand={opponentHand} deckCount={opponentDeck.length} />
      <GameInfo currentTurn={currentTurn} momentumGauge={momentumGauge} />
      <div className="flex mb-6">
        <LastPlayedCard card={lastPlayedCard} />
        <GameLog log={gameLog} />
      </div>
      <PlayerArea 
        hp={playerHP} 
        hand={playerHand} 
        onPlayCard={playCard} 
        onEndTurn={endTurn}
        currentTurn={currentTurn}
        deckCount={playerDeck.length}
      />
      <div className="mt-6 flex justify-center space-x-4">
        <Button 
          onClick={() => setShowExitConfirm(true)}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          Surrender
        </Button>
      </div>
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white p-6 rounded-lg shadow-xl"
            >
              <h2 className="text-xl font-bold mb-4">Are you sure you want to surrender?</h2>
              <div className="flex justify-end space-x-4">
                <Button onClick={() => setShowExitConfirm(false)}>Cancel</Button>
                <Button onClick={onExit} className="bg-red-500 hover:bg-red-600 text-white">Confirm</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {isGameOver && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <h2 className="text-2xl font-bold mb-4">{winner === 'player' ? 'You Win!' : 'You Lose!'}</h2>
            <p className="mb-4">
              {winner === 'player' 
                ? 'Congratulations! You've defeated your opponent.' 
                : 'Better luck next time! Keep practicing and improving your strategy.'}
            </p>
            <Button onClick={onExit} className="mt-4">Back to Menu</Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};