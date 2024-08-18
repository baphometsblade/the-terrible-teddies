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

const CARD_TYPES = {
  TEDDY: 'Teddy',
  ACTION: 'Action',
  ITEM: 'Item'
};

const TerribleTeddies = () => {
  const [gameState, setGameState] = useState('menu');
  const [player1Deck, setPlayer1Deck] = useState([]);
  const [player2Deck, setPlayer2Deck] = useState([]);
  const { toast } = useToast();

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
      className="text-center space-y-4"
    >
      <h1 className="text-4xl font-bold mb-6 text-purple-800">Terrible Teddies</h1>
      <p className="text-lg mb-4 text-gray-600">Welcome to the naughtiest teddy bear battle in town!</p>
      <div className="grid grid-cols-2 gap-4">
        <Button onClick={startGame} className="bg-purple-600 hover:bg-purple-700 text-white">
          Start Game
        </Button>
        <Button onClick={() => setGameState('deckBuilder')} className="bg-blue-600 hover:bg-blue-700 text-white">
          Deck Builder
        </Button>
        <Button onClick={() => setGameState('tutorial')} className="bg-green-600 hover:bg-green-700 text-white">
          How to Play
        </Button>
        <Button onClick={() => setGameState('leaderboard')} className="bg-yellow-600 hover:bg-yellow-700 text-white">
          Leaderboard
        </Button>
        <Button onClick={() => setGameState('dailyChallenge')} className="bg-red-600 hover:bg-red-700 text-white">
          Daily Challenge
        </Button>
      </div>
    </motion.div>
  );

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
      </AnimatePresence>
    </div>
  );
};

export default TerribleTeddies;