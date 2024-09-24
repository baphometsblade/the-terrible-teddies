import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useGeneratedImages, useUserDeck, useUpdateUserStats } from '../../integrations/supabase';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { GameLog } from './GameLog';
import { CardDetail } from './CardDetail';
import { GameOverScreen } from '../GameOverScreen';
import { playSound } from '../../utils/audio';
import { applyCardEffect } from '../../utils/gameLogic';
import { AIOpponent } from '../../utils/AIOpponent';

export const GameBoard = ({ gameMode, onExit, settings }) => {
  const [gameState, setGameState] = useState({
    playerHP: 30,
    opponentHP: 30,
    playerHand: [],
    opponentHand: [],
    playerDeck: [],
    opponentDeck: [],
    currentTurn: 'player',
    momentumGauge: 0,
    lastPlayedCard: null,
    gameLog: [],
    activeEffects: { player: [], opponent: [] },
  });
  const [selectedCard, setSelectedCard] = useState(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const { toast } = useToast();
  const { data: allCards, isLoading: isLoadingCards } = useGeneratedImages();
  const { data: userDeck } = useUserDeck();
  const updateUserStats = useUpdateUserStats();
  const aiOpponent = new AIOpponent();

  useEffect(() => {
    if (allCards && userDeck) {
      initializeGame();
    }
  }, [allCards, userDeck]);

  const initializeGame = () => {
    const playerDeckCards = userDeck && userDeck.length > 0 ? userDeck : allCards.slice(0, 20);
    const opponentDeckCards = allCards.slice(20, 40);
    setGameState(prevState => ({
      ...prevState,
      playerDeck: shuffleArray(playerDeckCards),
      opponentDeck: shuffleArray(opponentDeckCards),
      playerHand: drawCards(5, playerDeckCards),
      opponentHand: drawCards(5, opponentDeckCards),
    }));
  };

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const drawCards = (count, deck) => {
    return deck.slice(0, count);
  };

  const playCard = (card) => {
    if (gameState.currentTurn !== 'player') return;
    if (gameState.momentumGauge + card.energy_cost > 10) {
      toast({
        title: "Not enough Momentum!",
        description: "You need more Momentum to play this card.",
        variant: "destructive",
      });
      playSound('error');
      return;
    }
    
    setGameState(prevState => {
      const newState = applyCardEffect(prevState, card, false);
      return {
        ...newState,
        playerHand: prevState.playerHand.filter(c => c.id !== card.id),
        lastPlayedCard: card,
      };
    });
    
    playSound('playCard');
    
    if (gameState.momentumGauge + card.energy_cost >= 10) {
      endTurn();
    }
  };

  const aiTurn = useCallback(() => {
    if (gameState.currentTurn === 'opponent' && gameMode === 'singlePlayer') {
      setTimeout(() => {
        const aiCard = aiOpponent.chooseCard(gameState.opponentHand, gameState);
        setGameState(prevState => {
          const newState = applyCardEffect(prevState, aiCard, true);
          return {
            ...newState,
            opponentHand: prevState.opponentHand.filter(c => c.id !== aiCard.id),
          };
        });
        
        playSound('playCard');
        endTurn();
      }, 1000);
    }
  }, [gameState, gameMode]);

  useEffect(() => {
    aiTurn();
  }, [gameState.currentTurn, aiTurn]);

  const endTurn = () => {
    setGameState(prevState => {
      const newState = {
        ...prevState,
        currentTurn: prevState.currentTurn === 'player' ? 'opponent' : 'player',
        momentumGauge: 0,
      };
      if (newState.currentTurn === 'player') {
        newState.playerHand = [...newState.playerHand, ...drawCards(1, newState.playerDeck)];
      } else {
        newState.opponentHand = [...newState.opponentHand, ...drawCards(1, newState.opponentDeck)];
      }
      return checkActiveEffects(newState);
    });
  };

  const checkActiveEffects = (state) => {
    const newState = { ...state };
    ['player', 'opponent'].forEach(side => {
      newState.activeEffects[side] = newState.activeEffects[side].filter(effect => {
        if (effect.type === 'Trap') {
          return applyCardEffect(newState, effect, side === 'opponent');
        }
        return true;
      });
    });
    return newState;
  };

  const checkGameOver = useCallback(() => {
    if (gameState.playerHP <= 0 || gameState.opponentHP <= 0) {
      const winner = gameState.playerHP > 0 ? 'player' : 'opponent';
      setWinner(winner);
      setIsGameOver(true);
      updateUserStats.mutate({ 
        games_played: 1, 
        games_won: winner === 'player' ? 1 : 0 
      });
      playSound(winner === 'player' ? 'victory' : 'defeat');
    }
  }, [gameState.playerHP, gameState.opponentHP, updateUserStats]);

  useEffect(() => {
    checkGameOver();
  }, [gameState.playerHP, gameState.opponentHP, checkGameOver]);

  const handlePlayAgain = () => {
    setIsGameOver(false);
    setWinner(null);
    initializeGame();
  };

  if (isLoadingCards) {
    return <div>Loading game...</div>;
  }

  return (
    <div className="game-board p-4 bg-gradient-to-b from-pink-100 to-purple-200 rounded-lg shadow-xl">
      <OpponentArea hp={gameState.opponentHP} hand={gameState.opponentHand} />
      <GameInfo currentTurn={gameState.currentTurn} momentumGauge={gameState.momentumGauge} />
      <div className="flex mb-6">
        <div className="w-1/2 pr-2">
          <AnimatePresence>
            {gameState.lastPlayedCard && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="last-played-card bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-lg shadow-md"
              >
                <CardDetail card={gameState.lastPlayedCard} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="w-1/2 pl-2">
          <GameLog logs={gameState.gameLog} />
        </div>
      </div>
      <PlayerArea 
        hp={gameState.playerHP} 
        maxHp={30} 
        hand={gameState.playerHand} 
        onPlayCard={playCard}
        onSelectCard={setSelectedCard}
      />
      <div className="mt-6 space-x-4 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={endTurn}
          disabled={gameState.currentTurn !== 'player'}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          End Turn
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onExit}
          className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300"
        >
          Surrender
        </motion.button>
      </div>
      {selectedCard && (
        <CardDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
      {isGameOver && (
        <GameOverScreen
          winner={winner}
          playerScore={gameState.playerHP}
          opponentScore={gameState.opponentHP}
          onPlayAgain={handlePlayAgain}
          onMainMenu={onExit}
        />
      )}
    </div>
  );
};
