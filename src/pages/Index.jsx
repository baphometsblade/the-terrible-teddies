import React, { useState, useEffect } from 'react';
import { useSupabaseAuth, SupabaseAuthUI } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Loader2, PawPrint, Info, Trophy, Book } from 'lucide-react';
import { motion } from 'framer-motion';
import { GameBoard } from '../components/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { LeaderboardComponent } from '../components/LeaderboardComponent';
import { TutorialComponent } from '../components/TutorialComponent';
import { useToast } from "@/components/ui/use-toast";
import { useGeneratedImages } from '../integrations/supabase';

const Index = () => {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading');
  const { toast } = useToast();
  const { data: generatedImages, isLoading: imagesLoading, error: imagesError, refetch: refetchImages } = useGeneratedImages();

  const handleGenerateAssets = async () => {
    try {
      setGameState('loading');
      const response = await fetch('https://lov-p-1db83e7a-8789-4219-a42f-bff44602358e.fly.dev/api/generate-assets', { method: 'POST' });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate assets: ${response.status} ${response.statusText}. ${errorText}`);
      }
      await refetchImages();
      toast({
        title: "Success",
        description: "Assets generated successfully. Reloading game...",
        variant: "success",
        duration: 3000,
      });
      setGameState('menu');
    } catch (error) {
      console.error('Error generating assets:', error);
      toast({
        title: "Error",
        description: `Failed to generate assets: ${error.message}`,
        variant: "destructive",
        duration: 5000,
      });
      setGameState('error');
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!session) {
        setGameState('auth');
      } else if (imagesLoading) {
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
      } else if (generatedImages && generatedImages.length > 0) {
        console.log(`Loaded ${generatedImages.length} images successfully`);
        setGameState('menu');
      } else {
        console.error('No game assets found');
        toast({
          title: "Error",
          description: "No game assets found. Please run the asset generation script.",
          variant: "destructive",
          duration: 5000,
        });
        setGameState('error');
      }
    }
  }, [authLoading, session, imagesLoading, imagesError, generatedImages, toast]);

  const renderContent = () => {
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
              <PawPrint className="mr-2 h-4 w-4" /> Start Game
            </Button>
            <Button onClick={() => setGameState('deckBuilder')} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <Book className="mr-2 h-4 w-4" /> Deck Builder
            </Button>
            <Button onClick={() => setGameState('leaderboard')} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <Trophy className="mr-2 h-4 w-4" /> Leaderboard
            </Button>
            <Button onClick={() => setGameState('tutorial')} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
              <Info className="mr-2 h-4 w-4" /> Tutorial
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
      case 'tutorial':
        return <TutorialComponent onExit={() => setGameState('menu')} />;
      case 'error':
        return (
          <div className="text-center">
            <p className="text-lg text-red-600 mb-4">Failed to load game assets</p>
            <p className="text-sm text-gray-600 mb-4">Please try generating assets or contact support if the issue persists.</p>
            <Button onClick={handleGenerateAssets} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white">
              Generate Assets
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