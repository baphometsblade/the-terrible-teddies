import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { useUserStats } from '../hooks/useUserStats';
import { Sparkles, Trophy, Book, ShoppingCart, Target, PlayCircle, Loader2 } from 'lucide-react';

const DeckBuilder = lazy(() => import('./DeckBuilder'));
const GameBoard = lazy(() => import('./GameBoard'));
const TutorialComponent = lazy(() => import('./TutorialComponent'));
const LeaderboardComponent = lazy(() => import('./LeaderboardComponent'));
const DailyChallenge = lazy(() => import('./DailyChallenge'));
const Shop = lazy(() => import('./Shop'));

const TerribleTeddies = () => {
  const [gameState, setGameState] = useState('menu');
  const [playerDeck, setPlayerDeck] = useState([]);
  const { toast } = useToast();
  const { userStats, isLoadingStats } = useUserStats();

  const startGame = () => {
    setGameState('playing');
  };

  const handleSaveDeck = (deck) => {
    setPlayerDeck(deck);
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
      transition={{ duration: 0.5 }}
      className="text-center space-y-8"
    >
      <h1 className="text-6xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        Terrible Teddies
      </h1>
      <p className="text-2xl mb-8 text-gray-700">Welcome to the naughtiest teddy bear battle in town!</p>
      {!isLoadingStats && (
        <Card className="mb-8 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow-lg">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold text-purple-800 mb-4">Your Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-lg font-medium text-gray-700">Coins</p>
                <p className="text-3xl font-bold text-yellow-500">{userStats?.coins || 0}</p>
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">Games Won</p>
                <p className="text-3xl font-bold text-green-500">{userStats?.games_won || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-6">
        <MenuButton onClick={startGame} color="purple" icon={<PlayCircle className="w-6 h-6" />}>Start Game</MenuButton>
        <MenuButton onClick={() => setGameState('deckBuilder')} color="blue" icon={<Sparkles className="w-6 h-6" />}>Deck Builder</MenuButton>
        <MenuButton onClick={() => setGameState('tutorial')} color="green" icon={<Book className="w-6 h-6" />}>How to Play</MenuButton>
        <MenuButton onClick={() => setGameState('leaderboard')} color="yellow" icon={<Trophy className="w-6 h-6" />}>Leaderboard</MenuButton>
        <MenuButton onClick={() => setGameState('dailyChallenge')} color="red" icon={<Target className="w-6 h-6" />}>Daily Challenge</MenuButton>
        <MenuButton onClick={() => setGameState('shop')} color="indigo" icon={<ShoppingCart className="w-6 h-6" />}>Shop</MenuButton>
      </div>
    </motion.div>
  );

  const MenuButton = ({ onClick, color, children, icon }) => (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all duration-300 bg-gradient-to-r ${getGradient(color)} flex items-center justify-center space-x-2`}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
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

  const renderComponent = (Component) => (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <Component />
    </Suspense>
  );

  return (
    <div className="container mx-auto p-8">
      <AnimatePresence mode="wait">
        {gameState === 'menu' && renderMenu()}
        {gameState === 'playing' && renderComponent(() => <GameBoard playerDeck={playerDeck} onExit={() => setGameState('menu')} />)}
        {gameState === 'deckBuilder' && renderComponent(() => <DeckBuilder onSaveDeck={handleSaveDeck} initialDeck={playerDeck} />)}
        {gameState === 'tutorial' && renderComponent(() => <TutorialComponent onExit={() => setGameState('menu')} />)}
        {gameState === 'leaderboard' && renderComponent(() => (
          <>
            <LeaderboardComponent />
            <Button onClick={() => setGameState('menu')} className="mt-8">Back to Menu</Button>
          </>
        ))}
        {gameState === 'dailyChallenge' && renderComponent(() => <DailyChallenge onExit={() => setGameState('menu')} />)}
        {gameState === 'shop' && renderComponent(() => <Shop onClose={() => setGameState('menu')} />)}
      </AnimatePresence>
    </div>
  );
};

export default TerribleTeddies;