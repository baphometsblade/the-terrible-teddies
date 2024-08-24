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
import { TurnIndicator } from './TurnIndicator';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLogic } from '../../hooks/useGameLogic';
import { useTerribleTeddiesCards, useUserDeck, useUpdateUserStats } from '../../integrations/supabase';
import { LoadingSpinner } from '../LoadingSpinner';
import confetti from 'canvas-confetti';

export const GameBoard = ({ onExit, settings, gameId = null }) => {
  const [isMultiplayer, setIsMultiplayer] = useState(!!gameId);
  const { data: allCards, isLoading: isLoadingCards } = useTerribleTeddiesCards();
  const { data: userDeck, isLoading: isLoadingDeck } = useUserDeck();
  const updateUserStats = useUpdateUserStats();
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
    playerEnergy,
    opponentEnergy,
  } = useGameLogic();

  const handleInitializeGame = useCallback(
  () => {
    if (allCards && userDeck) {
      if (isMultiplayer) {
        // Initialize multiplayer game
        initializeMultiplayerGame(gameId, userDeck.length > 0 ? userDeck : allCards.slice(0, 20));
      } else {
        initializeGame(userDeck.length > 0 ? userDeck : allCards.slice(0, 20));
      }
    }
  },
  [allCards, userDeck, initializeGame, isMultiplayer, gameId]
);

const initializeMultiplayerGame = async (gameId, deck) => {
  // Logic to initialize a multiplayer game
  // This would involve setting up real-time listeners for the game state
  // and handling turn-based gameplay between two players
  // For brevity, we'll just set up a basic listener here
  const gameSubscription = supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, handleGameUpdate)
    .subscribe();

  // Initialize the game state
  initializeGame(deck);

  return () => {
    gameSubscription.unsubscribe();
  };
};

const handleGameUpdate = (payload) => {
  // Handle game state updates from the server
  // This would update the local game state based on the opponent's moves
  console.log('Game update:', payload);
  // Update game state here based on the payload
};

// Continue with the rest of the component...() => {
    if (allCards && userDeck) {
      initializeGame(userDeck.length > 0 ? userDeck : allCards.slice(0, 20));
    }
  }, [allCards, userDeck, initializeGame]);

  useEffect(() => {
    if (!isLoadingCards && !isLoadingDeck) {
      handleInitializeGame();
    }
  }, [isLoadingCards, isLoadingDeck, handleInitializeGame]);

  const handlePlayCard = (card) => {
    if (currentTurn !== 'player') return;
    if (playerEnergy < card.energy_cost) {
      toast({
        title: "Not enough Energy!",
        description: `You need ${card.energy_cost} energy to play this card.`,
        variant: "destructive",
      });
      return;
    }
    playCard(card);
  };

  const handleEndTurn = () => {
    if (currentTurn === 'player') {
      endTurn();
    }
  };

  const handlePlayAgain = () => {
    handleInitializeGame();
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
    if (isGameOver) {
      if (winner === 'player') {
        updateUserStats.mutate({ games_won: 1, coins: 50 });
        if (settings.soundEnabled) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } else {
        updateUserStats.mutate({ games_played: 1 });
      }
    }
  }, [isGameOver, winner, settings.soundEnabled, updateUserStats]);

  if (isLoadingCards || isLoadingDeck) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Game Data</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <Button onClick={onExit} className="bg-blue-500 hover:bg-blue-600 text-white">
            Return to Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className={`game-board p-6 rounded-2xl shadow-2xl ${settings.darkMode ? 'bg-gray-800 text-white' : 'bg-gradient-to-b from-pink-100 to-purple-200'}`}
    >
      <OpponentArea hp={opponentHP} hand={opponentHand} energy={opponentEnergy} darkMode={settings.darkMode} />
      <GameInfo currentTurn={currentTurn} momentumGauge={momentumGauge} darkMode={settings.darkMode} />
      <MomentumGauge value={momentumGauge} darkMode={settings.darkMode} />
      <TurnIndicator currentTurn={currentTurn} darkMode={settings.darkMode} />
      <div className="flex mb-6 space-x-4">
        <LastPlayedCard card={lastPlayedCard} darkMode={settings.darkMode} />
        <GameLog log={gameLog} darkMode={settings.darkMode} />
      </div>
      <PlayerArea 
        hp={playerHP} 
        hand={playerHand} 
        onPlayCard={handlePlayCard} 
        currentTurn={currentTurn}
        energy={playerEnergy}
        darkMode={settings.darkMode}
      />
      <PlayerHand hand={playerHand} onPlayCard={handlePlayCard} darkMode={settings.darkMode} />
      <div className="mt-8 flex justify-center space-x-6">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button 
            onClick={handleEndTurn}
            disabled={currentTurn !== 'player'}
            className={`font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 ${
              settings.darkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
            }`}
          >
            End Turn
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button 
            onClick={handleSpecialMove}
            disabled={currentTurn !== 'player' || momentumGauge < 10}
            className={`font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 ${
              settings.darkMode 
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                : 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white'
            }`}
          >
            Special Move
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button 
            onClick={onExit}
            className={`font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 ${
              settings.darkMode 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white'
            }`}
          >
            Surrender
          </Button>
        </motion.div>
      </div>
      <AnimatePresence>
        {lastPlayedCard && (
          <CardEffects effect={lastPlayedCard.specialMove} type={lastPlayedCard.type} darkMode={settings.darkMode} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isGameOver && (
          <GameOverModal 
            winner={winner} 
            onPlayAgain={handlePlayAgain} 
            onExit={onExit} 
            darkMode={settings.darkMode}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSpecialMoveModal && (
          <SpecialMoveModal 
            onClose={() => setShowSpecialMoveModal(false)}
            onSelectMove={executeSpecialMove}
            darkMode={settings.darkMode}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GameBoard;