import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Loader2, PawPrint, Settings, Trophy, Book } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase';
import { GameBoard } from '../components/GameBoard/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { LeaderboardComponent } from '../components/LeaderboardComponent';
import { GameSettings } from '../components/GameSettings';
import { CardShop } from '../components/CardShop';
import { AssetGenerator } from '../components/AssetGenerator';
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading');
  const [gameSettings, setGameSettings] = useState({
    difficulty: 'normal',
    soundEnabled: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    const checkAssets = async () => {
      if (!authLoading && session) {
        try {
          setGameState('loading');
          const { count, error } = await supabase
            .from('generated_images')
            .select('*', { count: 'exact', head: true });
          
          if (error) throw error;

          setGameState(count === 0 ? 'needsAssets' : 'menu');
        } catch (error) {
          console.error('Error checking assets:', error);
          toast({
            title: "Error",
            description: "Failed to check game assets. Please try again.",
            variant: "destructive",
          });
          setGameState('error');
        }
      }
    };

    checkAssets();
  }, [authLoading, session, toast]);

  const renderContent = () => {
    switch (gameState) {
      case 'loading':
        return (
          <div className="text-center text-2xl text-gray-600">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            Loading game...
          </div>
        );
      case 'needsAssets':
        return <AssetGenerator />;
      case 'menu':
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold text-purple-800 mb-8">Welcome to Terrible Teddies!</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <Button onClick={() => setGameState('game')} className="bg-purple-600 hover:bg-purple-700 text-white text-lg py-6">
                <PawPrint className="w-6 h-6 mr-2" />
                Start Game
              </Button>
              <Button onClick={() => setGameState('deckBuilder')} className="bg-blue-600 hover:bg-blue-700 text-white text-lg py-6">
                <Book className="w-6 h-6 mr-2" />
                Deck Builder
              </Button>
              <Button onClick={() => setGameState('leaderboard')} className="bg-yellow-600 hover:bg-yellow-700 text-white text-lg py-6">
                <Trophy className="w-6 h-6 mr-2" />
                Leaderboard
              </Button>
              <Button onClick={() => setGameState('settings')} className="bg-pink-600 hover:bg-pink-700 text-white text-lg py-6">
                <Settings className="w-6 h-6 mr-2" />
                Game Settings
              </Button>
              <Button onClick={() => setGameState('cardShop')} className="bg-green-600 hover:bg-green-700 text-white text-lg py-6">
                <PawPrint className="w-6 h-6 mr-2" />
                Card Shop
              </Button>
              <Button onClick={() => setGameState('needsAssets')} className="bg-orange-600 hover:bg-orange-700 text-white text-lg py-6">
                <Loader2 className="w-6 h-6 mr-2" />
                Regenerate Assets
              </Button>
            </div>
          </div>
        );
      case 'game':
        return <GameBoard gameMode="singlePlayer" onExit={() => setGameState('menu')} settings={gameSettings} />;
      case 'deckBuilder':
        return <DeckBuilder onExit={() => setGameState('menu')} />;
      case 'leaderboard':
        return (
          <div>
            <LeaderboardComponent />
            <Button onClick={() => setGameState('menu')} className="mt-8 bg-purple-600 hover:bg-purple-700 text-white">Back to Menu</Button>
          </div>
        );
      case 'settings':
        return (
          <GameSettings
            settings={gameSettings}
            onSettingsChange={setGameSettings}
            onBack={() => setGameState('menu')}
          />
        );
      case 'cardShop':
        return <CardShop onExit={() => setGameState('menu')} />;
      case 'error':
        return (
          <div className="text-center text-2xl text-red-600">
            An error occurred while loading the game. Please try again later.
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200 flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white rounded-lg shadow-xl">
        <header className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <PawPrint className="w-24 h-24 mx-auto text-purple-600" />
          </motion.div>
          <h1 className="text-5xl font-bold text-purple-800 mt-6 mb-2">Terrible Teddies</h1>
          <p className="text-2xl text-purple-600">The cutest card battle game!</p>
        </header>
        {renderContent()}
      </div>
    </div>
  );
};

export default Index;
