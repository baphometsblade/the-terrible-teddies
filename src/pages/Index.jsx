import React, { useState, useEffect } from 'react';
import { useSupabaseAuth, SupabaseAuthProvider } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PawPrint } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase';

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasError) {
      console.error("Error caught by ErrorBoundary:", error);
    }
  }, [hasError, error]);

  if (hasError) {
    return (
      <div className="text-center text-red-600">
        <h2>Something went wrong.</h2>
        <details style={{ whiteSpace: 'pre-wrap' }}>
          {error && error.toString()}
        </details>
      </div>
    );
  }

  return children;
};

const IndexContent = () => {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading');

  useEffect(() => {
    const checkImagesGenerated = async () => {
      if (!authLoading && session) {
        try {
          const { count, error } = await supabase
            .from('generated_images')
            .select('*', { count: 'exact', head: true });
          
          if (error) throw error;

          setGameState(count > 0 ? 'menu' : 'imageGenerator');
        } catch (error) {
          console.error('Error checking generated images:', error);
          setGameState('error');
        }
      }
    };

    checkImagesGenerated();
  }, [authLoading, session]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-pink-100 to-purple-200">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-pink-100 to-purple-200">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-[350px] shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-purple-700">Welcome to Terrible Teddies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4 text-center">Please sign in to start your teddy adventure!</p>
              <Button 
                onClick={() => window.location.href = '/auth'} 
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200 flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-center mb-8">
          <PawPrint className="w-12 h-12 text-pink-500 mr-4" />
          <h1 className="text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
            Terrible Teddies
          </h1>
        </div>
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
          <div className="text-center text-2xl text-gray-600">
            Image generation required. Feature coming soon.
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

const Index = () => (
  <ErrorBoundary>
    <SupabaseAuthProvider>
      <IndexContent />
    </SupabaseAuthProvider>
  </ErrorBoundary>
);

export default Index;