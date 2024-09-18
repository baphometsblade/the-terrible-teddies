import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PawPrint } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase';
import { ImageGenerator } from '../components/ImageGenerator';
import { GameBoard } from '../components/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { LeaderboardComponent } from '../components/LeaderboardComponent';
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading');
  const [imagesGenerated, setImagesGenerated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkImagesGenerated = async () => {
      if (!authLoading && session) {
        try {
          const { count, error } = await supabase
            .from('generated_images')
            .select('*', { count: 'exact', head: true });
          
          if (error) throw error;

          setImagesGenerated(count > 0);
          setGameState(count > 0 ? 'menu' : 'imageGenerator');
        } catch (error) {
          console.error('Error checking generated images:', error);
          toast({
            title: "Error",
            description: "Failed to check generated images. Please try again.",
            variant: "destructive",
          });
          setGameState('error');
        }
      } else if (!authLoading && !session) {
        setGameState('auth');
      }
    };

    checkImagesGenerated();
  }, [authLoading, session, toast]);

  const handleImageGenerationComplete = () => {
    setImagesGenerated(true);
    setGameState('menu');
  };

  const renderContent = () => {
    switch (gameState) {
      case 'loading':
        return (
          <div className="text-center text-2xl text-gray-600">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            Loading game assets...
          </div>
        );
      case 'auth':
        return (
          <div className="text-center">
            <h2 className="text-2xl text-gray-600 mb-4">Please log in to play</h2>
            <SupabaseAuthUI />
          </div>
        );
      case 'imageGenerator':
        return (
          <div className="text-center">
            <h2 className="text-2xl text-gray-600 mb-4">Image Generation Required</h2>
            <ImageGenerator onComplete={handleImageGenerationComplete} />
          </div>
        );
      case 'menu':
        return (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-purple-800 mb-6">Welcome to Terrible Teddies!</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button onClick={() => setGameState('game')} className="bg-purple-600 hover:bg-purple-700 text-white">
                Start Game
              </Button>
              <Button onClick={() => setGameState('deckBuilder')} className="bg-blue-600 hover:bg-blue-700 text-white">
                Deck Builder
              </Button>
              <Button onClick={() => setGameState('leaderboard')} className="bg-green-600 hover:bg-green-700 text-white">
                Leaderboard
              </Button>
              <Button onClick={() => setGameState('rules')} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                Game Rules
              </Button>
            </div>
          </div>
        );
      case 'game':
        return <GameBoard gameMode="singlePlayer" onExit={() => setGameState('menu')} />;
      case 'deckBuilder':
        return <DeckBuilder onExit={() => setGameState('menu')} />;
      case 'leaderboard':
        return (
          <div>
            <LeaderboardComponent />
            <Button onClick={() => setGameState('menu')} className="mt-4">Back to Menu</Button>
          </div>
        );
      case 'rules':
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Game Rules</h2>
            <p className="mb-4">Detailed game rules will be added here.</p>
            <Button onClick={() => setGameState('menu')}>Back to Menu</Button>
          </div>
        );
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
            <PawPrint className="w-16 h-16 mx-auto text-purple-600" />
          </motion.div>
          <h1 className="text-4xl font-bold text-purple-800 mt-4">Terrible Teddies</h1>
          <p className="text-xl text-purple-600">The cutest card battle game!</p>
        </header>
        {renderContent()}
      </div>
    </div>
  );
};

export default Index;