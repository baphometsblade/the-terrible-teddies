import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { useUserStats } from '../integrations/supabase';
import { Sparkles, Trophy, Book, ShoppingCart, Target, PlayCircle, Users, Settings } from 'lucide-react';
import { DeckBuilder } from './DeckBuilder';
import { Auth } from './Auth';
import { useCurrentUser } from '../integrations/supabase';
import { LoadingSpinner } from './LoadingSpinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CardCollection } from './CardCollection';

const GameBoard = lazy(() => import('./GameBoard').then(module => ({ default: module.GameBoard })));
const TutorialComponent = lazy(() => import('./TutorialComponent').then(module => ({ default: module.TutorialComponent })));
const LeaderboardComponent = lazy(() => import('./LeaderboardComponent').then(module => ({ default: module.LeaderboardComponent })));
const DailyChallenge = lazy(() => import('./DailyChallenge').then(module => ({ default: module.DailyChallenge })));
const Shop = lazy(() => import('./Shop').then(module => ({ default: module.Shop })));
const Multiplayer = lazy(() => import('./Multiplayer').then(module => ({ default: module.Multiplayer })));

const TerribleTeddies = () => {
  const [gameState, setGameState] = useState('menu');
  const [playerDeck, setPlayerDeck] = useState([]);
  const { toast } = useToast();
  const { data: userStats, isLoading: isLoadingStats } = useUserStats();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const [settings, setSettings] = useState({
    soundEnabled: true,
    darkMode: false,
    highPerformanceMode: false,
  });
  const [showCardCollection, setShowCardCollection] = useState(false);

  const startGame = () => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "Please log in to start a game.",
        variant: "destructive",
      });
      return;
    }
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

  const handleSettingChange = (setting) => {
    setSettings(prev => ({ ...prev, [setting]: !prev[setting] }));
    toast({
      title: "Setting Updated",
      description: `${setting} has been ${settings[setting] ? 'disabled' : 'enabled'}.`,
      variant: "success",
    });
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
      {!isLoadingUser && (
        currentUser ? (
          <>
            {!isLoadingStats && userStats && (
              <Card className="mb-8 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg shadow-lg">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-semibold text-purple-800 mb-4">Your Stats</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-lg font-medium text-gray-700">Coins</p>
                      <p className="text-3xl font-bold text-yellow-500">{userStats.coins || 0}</p>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-700">Games Won</p>
                      <p className="text-3xl font-bold text-green-500">{userStats.games_won || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <MenuButton onClick={startGame} color="purple" icon={<PlayCircle className="w-6 h-6" />}>Start Game</MenuButton>
              <MenuButton onClick={() => setGameState('deckBuilder')} color="blue" icon={<Sparkles className="w-6 h-6" />}>Deck Builder</MenuButton>
              <MenuButton onClick={() => setGameState('tutorial')} color="green" icon={<Book className="w-6 h-6" />}>How to Play</MenuButton>
              <MenuButton onClick={() => setGameState('leaderboard')} color="yellow" icon={<Trophy className="w-6 h-6" />}>Leaderboard</MenuButton>
              <MenuButton onClick={() => setGameState('dailyChallenge')} color="red" icon={<Target className="w-6 h-6" />}>Daily Challenge</MenuButton>
              <MenuButton onClick={() => setGameState('shop')} color="indigo" icon={<ShoppingCart className="w-6 h-6" />}>Shop</MenuButton>
              <MenuButton onClick={() => setShowCardCollection(true)} color="yellow" icon={<Book className="w-6 h-6" />}>Card Collection</MenuButton>
              <MenuButton onClick={() => setGameState('multiplayer')} color="pink" icon={<Users className="w-6 h-6" />}>Multiplayer</MenuButton>
              <Dialog>
                <DialogTrigger asChild>
                  <MenuButton color="gray" icon={<Settings className="w-6 h-6" />}>Settings</MenuButton>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Game Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sound">Sound</Label>
                      <Switch
                        id="sound"
                        checked={settings.soundEnabled}
                        onCheckedChange={() => handleSettingChange('soundEnabled')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="darkMode">Dark Mode</Label>
                      <Switch
                        id="darkMode"
                        checked={settings.darkMode}
                        onCheckedChange={() => handleSettingChange('darkMode')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="highPerformance">High Performance Mode</Label>
                      <Switch
                        id="highPerformance"
                        checked={settings.highPerformanceMode}
                        onCheckedChange={() => handleSettingChange('highPerformanceMode')}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </>
        ) : (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold text-purple-800 mb-4">Login or Sign Up</h2>
            <Auth />
          </div>
        )
      )}
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
      pink: 'from-pink-500 to-pink-700',
      gray: 'from-gray-500 to-gray-700',
    };
    return gradients[color] || gradients.purple;
  };

  const renderComponent = (Component) => (
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  );

  return (
    <div className={`container mx-auto p-4 md:p-8 ${settings.darkMode ? 'dark' : ''}`}>
      <AnimatePresence mode="wait">
        {gameState === 'menu' && renderMenu()}
        {gameState === 'playing' && renderComponent(() => <GameBoard playerDeck={playerDeck} onExit={() => setGameState('menu')} settings={settings} />)}
        {gameState === 'deckBuilder' && <DeckBuilder onSaveDeck={handleSaveDeck} initialDeck={playerDeck} />}
        {gameState === 'tutorial' && renderComponent(() => <TutorialComponent onExit={() => setGameState('menu')} />)}
        {gameState === 'leaderboard' && renderComponent(() => (
          <>
            <LeaderboardComponent />
            <Button onClick={() => setGameState('menu')} className="mt-8">Back to Menu</Button>
          </>
        ))}
        {gameState === 'dailyChallenge' && renderComponent(() => <DailyChallenge onExit={() => setGameState('menu')} />)}
        {gameState === 'shop' && renderComponent(() => <Shop onClose={() => setGameState('menu')} />)}
        {gameState === 'multiplayer' && renderComponent(() => <Multiplayer onExit={() => setGameState('menu')} />)}
        {showCardCollection && <CardCollection onClose={() => setShowCardCollection(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default TerribleTeddies;