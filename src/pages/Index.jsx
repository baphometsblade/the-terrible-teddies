import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PawPrint } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase';
import { ImageGenerator } from '../components/ImageGenerator';

// ... (keep existing code)

const IndexContent = () => {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading');
  const [imagesGenerated, setImagesGenerated] = useState(false);

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
          setGameState('error');
        }
      }
    };

    checkImagesGenerated();
  }, [authLoading, session]);

  const handleImageGenerationComplete = () => {
    setImagesGenerated(true);
    setGameState('menu');
  };

  // ... (keep existing rendering logic)

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200 flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white rounded-lg shadow-xl">
        {/* ... (keep existing header) */}
        {gameState === 'loading' && (
          <div className="text-center text-2xl text-gray-600">
            Loading game assets...
          </div>
        )}
        {gameState === 'menu' && (
          <div className="text-center text-2xl text-gray-600">
            Welcome to Terrible Teddies! Game menu coming soon.
          </div>
        )}
        {gameState === 'imageGenerator' && (
          <div className="text-center">
            <h2 className="text-2xl text-gray-600 mb-4">Image Generation Required</h2>
            <ImageGenerator onComplete={handleImageGenerationComplete} />
          </div>
        )}
        {gameState === 'error' && (
          <div className="text-center text-2xl text-red-600">
            An error occurred while loading the game. Please try again later.
          </div>
        )}
      </div>
    </div>
  );
};

// ... (keep existing export)