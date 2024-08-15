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
      } else if (generatedImages && generatedImages.length > 0) {
        console.log('Game assets loaded successfully');
        setGameState('menu');
      } else {
        console.warn('No game assets found');
        toast({
          title: "No Game Assets",
          description: "No game assets found. Please generate initial assets.",
          variant: "warning",
          duration: 5000,
        });
        setGameState('error');
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
        description: "Failed to reload game assets. Please try generating initial assets.",
        variant: "destructive",
        duration: 5000,
      });
      setGameState('error');
    }
  };

  const generateInitialAssets = async () => {
    setGameState('loading');
    try {
      // Call gi5code to generate assets
      const response = await fetch('https://gi5code.com/api/generate-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: 'terrible-teddies',
          assetType: 'card-images',
          count: 40, // Generate 40 card images
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate assets');
      }

      const result = await response.json();
      toast({
        title: "Assets Generated",
        description: `Generated ${result.generatedCount} assets successfully.`,
        variant: "success",
        duration: 5000,
      });
      await refetchImages();
      setGameState('menu');
    } catch (error) {
      console.error('Error generating initial assets:', error);
      toast({
        title: "Error",
        description: "Failed to generate initial assets. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
      setGameState('error');
    }
  };

  // ... rest of the component code ...

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