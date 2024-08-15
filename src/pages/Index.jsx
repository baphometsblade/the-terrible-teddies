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
import { supabase } from '../integrations/supabase';

const Index = () => {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading');
  const [errorDetails, setErrorDetails] = useState('');
  const { toast } = useToast();
  const { data: generatedImages, isLoading: imagesLoading, error: imagesError, refetch: refetchImages } = useGeneratedImages();

  const checkAndPopulateAssets = async () => {
    try {
      const { count, error } = await supabase
        .from('generated_images')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      if (count === 0) {
        await generateInitialAssets();
      } else {
        setGameState('menu');
      }
    } catch (error) {
      console.error('Error checking/populating assets:', error);
      setErrorDetails(error.message);
      setGameState('error');
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      if (!authLoading) {
        if (!session) {
          setGameState('auth');
        } else if (imagesLoading) {
          setGameState('loading');
        } else if (imagesError) {
          console.error('Error loading images:', imagesError);
          setErrorDetails(imagesError.message || 'Unknown error occurred while loading images');
          setGameState('error');
        } else {
          await checkAndPopulateAssets();
        }
      }
    };

    initializeApp();
  }, [authLoading, session, imagesLoading, imagesError, generatedImages]);

  const generateInitialAssets = async () => {
    console.log('Generating initial assets');
    setGameState('loading');
    try {
      const cardTypes = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];
      const generatedAssets = Array.from({ length: 40 }, (_, i) => ({
        name: `Card ${i + 1}`,
        url: `https://picsum.photos/seed/${i}/200/300`,
        type: cardTypes[Math.floor(Math.random() * cardTypes.length)],
        prompt: 'Cute teddy bear for card game',
      }));

      const { data, error } = await supabase
        .from('generated_images')
        .insert(generatedAssets);

      if (error) throw error;

      console.log('Assets inserted successfully');
      toast({
        title: "Assets Generated",
        description: `Generated ${generatedAssets.length} assets successfully.`,
        variant: "success",
        duration: 5000,
      });

      await refetchImages();
      setGameState('menu');
    } catch (error) {
      console.error('Error generating initial assets:', error);
      setErrorDetails(error.message || 'Failed to generate initial assets');
      setGameState('error');
    }
  };

  const handleRetry = async () => {
    console.log('Retrying to load game assets');
    setGameState('loading');
    try {
      await checkAndPopulateAssets();
      toast({
        title: "Retrying",
        description: "Attempting to reload game assets...",
        duration: 3000,
      });
    } catch (error) {
      console.error('Error retrying:', error);
      setErrorDetails(error.message || 'Failed to reload game assets');
      setGameState('error');
    }
  };

  const renderContent = () => {
    console.log('Rendering content for game state:', gameState);
    switch (gameState) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-lg text-purple-700">Loading game assets...</p>
          </div>
        );
      case 'auth':
        return <SupabaseAuthUI />;
      case 'menu':
        return (
          <div className="space-y-4">
            <Button onClick={() => setGameState('game')} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              Start Game
            </Button>
            <Button onClick={() => setGameState('deckBuilder')} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Deck Builder
            </Button>
            <Button onClick={() => setGameState('leaderboard')} className="w-full bg-green-600 hover:bg-green-700 text-white">
              Leaderboard
            </Button>
          </div>
        );
      case 'game':
        return <GameBoard gameMode="singlePlayer" onExit={() => setGameState('menu')} />;
      case 'deckBuilder':
        return <DeckBuilder onExit={() => setGameState('menu')} />;
      case 'leaderboard':
        return (
          <>
            <LeaderboardComponent />
            <Button onClick={() => setGameState('menu')} className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white">
              Back to Menu
            </Button>
          </>
        );
      case 'error':
        return (
          <div className="text-center">
            <p className="text-lg text-red-600 mb-4">Failed to load game assets</p>
            <p className="text-sm text-gray-600 mb-4">{errorDetails}</p>
            <Button onClick={handleRetry} className="mr-2 bg-blue-600 hover:bg-blue-700 text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Retry
            </Button>
            <Button onClick={generateInitialAssets} className="bg-green-600 hover:bg-green-700 text-white">
              Generate Initial Assets
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-200 flex items-center justify-center">
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