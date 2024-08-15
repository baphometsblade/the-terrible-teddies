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

  useEffect(() => {
    console.log('Index component mounted');
    console.log('Auth loading:', authLoading);
    console.log('Session:', session);
    console.log('Images loading:', imagesLoading);
    console.log('Images error:', imagesError);
    console.log('Generated images:', generatedImages);

    if (!authLoading) {
      if (!session) {
        console.log('No session, setting game state to auth');
        setGameState('auth');
      } else if (imagesLoading) {
        console.log('Images loading, setting game state to loading');
        setGameState('loading');
      } else if (imagesError) {
        console.error('Error loading images:', imagesError);
        setErrorDetails(imagesError.message || 'Unknown error occurred while loading images');
        setGameState('error');
      } else if (generatedImages && generatedImages.length > 0) {
        console.log('Images loaded successfully, setting game state to menu');
        setGameState('menu');
      } else {
        console.warn('No game assets found');
        setErrorDetails('No game assets found. Please generate initial assets.');
        setGameState('error');
      }
    }
  }, [authLoading, session, imagesLoading, imagesError, generatedImages]);

  const handleRetry = async () => {
    console.log('Retrying to load game assets');
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
      setErrorDetails(error.message || 'Failed to reload game assets');
      setGameState('error');
    }
  };

  const generateInitialAssets = async () => {
    console.log('Generating initial assets');
    setGameState('loading');
    try {
      const cardTypes = ['Action', 'Trap', 'Special', 'Defense', 'Boost'];
      const generatedAssets = Array.from({ length: 40 }, (_, i) => ({
        name: `Card ${i + 1}`,
        url: `https://picsum.photos/seed/${i}/200/300`,
        type: cardTypes[Math.floor(Math.random() * cardTypes.length)],
        energy_cost: Math.floor(Math.random() * 5) + 1,
        prompt: 'Cute teddy bear for card game',
      }));

      console.log('Checking if generated_images table exists');
      const { error: tableCheckError } = await supabase
        .from('generated_images')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        console.error('Error checking generated_images table:', tableCheckError);
        throw new Error('The generated_images table does not exist or is not accessible.');
      }

      console.log('Inserting generated assets');
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