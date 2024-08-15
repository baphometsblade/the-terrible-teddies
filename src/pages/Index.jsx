import React, { useState, useEffect } from 'react';
import { useSupabaseAuth, SupabaseAuthUI } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Loader2, PawPrint, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { GameBoard } from '../components/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { LeaderboardComponent } from '../components/LeaderboardComponent';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages } from '../integrations/supabase';

const Index = () => {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading');
  const { toast } = useToast();
  const { data: generatedImages, isLoading: imagesLoading, error: imagesError, refetch: refetchImages } = useGeneratedImages();

  useEffect(() => {
    if (!authLoading && session) {
      if (imagesLoading) {
        setGameState('loading');
      } else if (imagesError) {
        console.error('Error loading images:', imagesError);
        toast({
          title: "Error",
          description: `Failed to load game assets: ${imagesError.message}`,
          variant: "destructive",
          duration: 5000,
        });
        setGameState('error');
      } else if (!generatedImages || generatedImages.length === 0) {
        console.warn('No game assets found');
        toast({
          title: "No Game Assets",
          description: "No game assets found. The game may not be fully set up yet.",
          variant: "warning",
          duration: 5000,
        });
        setGameState('error');
      } else {
        console.log('Game assets loaded successfully');
        setGameState('menu');
      }
    } else if (!authLoading && !session) {
      setGameState('auth');
    }
  }, [authLoading, session, imagesLoading, imagesError, generatedImages, toast]);

  const handleRetry = async () => {
    setGameState('loading');
    try {
      await refetchImages();
      toast({
        title: "Retrying",
        description: "Attempting to reload game assets...",
        duration: 3000,
      });
    } catch (error) {
      console.error('Error refetching images:', error);
      toast({
        title: "Error",
        description: "Failed to reload game assets. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
      setGameState('error');
    }
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
            <p className="mt-4">Total Cards: {generatedImages ? generatedImages.length : 0}</p>
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
            <p className="mb-4">
              Terrible Teddies is a card battle game where you face off against an opponent using your deck of cute but terrible teddy bears.
              Each player starts with 30 HP and a hand of cards. The goal is to reduce your opponent's HP to 0.
            </p>
            <h3 className="text-xl font-bold mb-2">Card Types:</h3>
            <ul className="list-disc list-inside mb-4">
              <li>Action: Deal damage to your opponent</li>
              <li>Trap: Set a trap that activates on your opponent's turn</li>
              <li>Special: Heal yourself or apply unique effects</li>
              <li>Defense: Protect yourself from incoming damage</li>
              <li>Boost: Increase your Momentum Gauge</li>
            </ul>
            <h3 className="text-xl font-bold mb-2">Gameplay:</h3>
            <ol className="list-decimal list-inside mb-4">
              <li>Players take turns playing cards from their hand</li>
              <li>Each card costs Momentum to play</li>
              <li>The Momentum Gauge fills up to 10 each turn</li>
              <li>When a player's Momentum Gauge is full, their turn ends</li>
              <li>Players draw a new card at the end of their turn</li>
              <li>The game continues until one player's HP reaches 0</li>
            </ol>
            <p className="mb-4">
              Strategy is key! Balance your card plays, manage your Momentum, and outsmart your opponent to win!
            </p>
            <Button onClick={() => setGameState('menu')}>Back to Menu</Button>
          </div>
        );
      case 'error':
        return (
          <div className="text-center">
            <p className="text-2xl text-red-600 mb-4">An error occurred while loading the game.</p>
            <Button onClick={handleRetry} className="bg-blue-500 hover:bg-blue-600 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[url('/images/teddy-background.jpg')] bg-cover bg-center flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white bg-opacity-90 rounded-lg shadow-xl">
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