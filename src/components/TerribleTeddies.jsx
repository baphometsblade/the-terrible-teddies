import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '../integrations/supabase';
import { DeckBuilder } from './DeckBuilder';
import { GameBoard } from './GameBoard';
import { TutorialComponent } from './TutorialComponent';
import { LeaderboardComponent } from './LeaderboardComponent';
import { DailyChallenge } from './DailyChallenge';
import { Shop } from './Shop';
import { useUserStats } from '../integrations/supabase';

const TerribleTeddies = () => {
  const [gameState, setGameState] = useState('menu');
  const [player1Deck, setPlayer1Deck] = useState([]);
  const [player2Deck, setPlayer2Deck] = useState([]);
  const { toast } = useToast();
  const { data: userStats, isLoading: isLoadingStats } = useUserStats();

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .select('*');
      if (error) throw error;
      shuffleAndDealCards(data);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast({
        title: "Error",
        description: "Failed to load game cards. Please try again.",
        variant: "destructive",
      });
    }
  };

  const shuffleAndDealCards = (cards) => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setPlayer1Deck(shuffled.slice(0, 30));
    setPlayer2Deck(shuffled.slice(30, 60));
  };

  const startGame = () => {
    setGameState('playing');
  };

  const handleSaveDeck = (deck) => {
    setPlayer1Deck(deck);
    toast({
      title: "Deck Saved",
      description: "Your custom deck of mischievous teddies has been saved!",
      variant: "success",
    });
    setGameState('menu');
  };

  const renderMenu = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center space-y-6"
    >
      <h1 className="text-5xl font-extrabold mb-8 text-purple-800 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
        Terrible Teddies
      </h1>
      <p className="text-xl mb-6 text-gray-600">Welcome to the naughtiest teddy bear battle in town!</p>
      {!isLoadingStats && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow-md">
          <p className="text-lg font-semibold text-purple-800">Your Stats</p>
          <p className="text-md text-gray-700">Coins: {userStats?.coins || 0}</p>
          <p className="text-md text-gray-700">Games Won: {userStats?.games_won || 0}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <MenuButton onClick={startGame} color="purple">Start Game</MenuButton>
        <MenuButton onClick={() => setGameState('deckBuilder')} color="blue">Deck Builder</MenuButton>
        <MenuButton onClick={() => setGameState('tutorial')} color="green">How to Play</MenuButton>
        <MenuButton onClick={() => setGameState('leaderboard')} color="yellow">Leaderboard</MenuButton>
        <MenuButton onClick={() => setGameState('dailyChallenge')} color="red">Daily Challenge</MenuButton>
        <MenuButton onClick={() => setGameState('shop')} color="indigo">Shop</MenuButton>
      </div>
    </motion.div>
  );

  const MenuButton = ({ onClick, color, children }) => (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`w-full py-3 px-6 rounded-full font-bold text-white shadow-lg transition-all duration-300 bg-gradient-to-r ${getGradient(color)}`}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );

  const getGradient = (color) => {
    const gradients = {
      purple: 'from-purple-500 to-purple-700',
      blue: 'from-blue-500 to-blue-700',
      green: 'from-green-500 to-green-700',
      yellow: 'from-yellow-500 to-yellow-700',
      red: 'from-red-500 to-red-700',
      indigo: 'from-indigo-500 to-indigo-700',
    };
    return gradients[color] || gradients.purple;
  };

  return (
    <div className="container mx-auto p-4">
      <AnimatePresence mode="wait">
        {gameState === 'menu' && renderMenu()}
        {gameState === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <GameBoard player1Deck={player1Deck} player2Deck={player2Deck} onExit={() => setGameState('menu')} />
          </motion.div>
        )}
        {gameState === 'deckBuilder' && (
          <motion.div
            key="deckBuilder"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            <DeckBuilder onSaveDeck={handleSaveDeck} />
          </motion.div>
        )}
        {gameState === 'tutorial' && (
          <motion.div
            key="tutorial"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
          >
            <TutorialComponent onExit={() => setGameState('menu')} />
          </motion.div>
        )}
        {gameState === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <LeaderboardComponent />
            <Button onClick={() => setGameState('menu')} className="mt-4">Back to Menu</Button>
          </motion.div>
        )}
        {gameState === 'dailyChallenge' && (
          <motion.div
            key="dailyChallenge"
            initial={{ opacity: 0, rotate: -10 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 10 }}
          >
            <DailyChallenge onExit={() => setGameState('menu')} />
          </motion.div>
        )}
        {gameState === 'shop' && (
          <motion.div
            key="shop"
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
          >
            <Shop onClose={() => setGameState('menu')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerribleTeddies;