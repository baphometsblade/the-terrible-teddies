import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { SupabaseAuthProvider } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameBoard } from '../components/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { ImageGenerator } from '../components/ImageGenerator';
import { Loader2, Teddy } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase';

const IndexContent = () => {
  const { session, loading: authLoading, logout } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading'); // 'loading', 'menu', 'singlePlayer', 'multiplayer', 'deckBuilder', 'imageGenerator'
  const [imagesGenerated, setImagesGenerated] = useState(false);

  useEffect(() => {
    const checkImagesGenerated = async () => {
      if (!authLoading && session) {
        const { data, error } = await supabase
          .from('generated_images')
          .select('name');
        
        if (error) {
          console.error('Error checking generated images:', error);
          return;
        }

        if (data.length === 0) {
          setGameState('imageGenerator');
        } else {
          setImagesGenerated(true);
          setGameState('menu');
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

  const renderMenu = () => (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Button 
        onClick={() => setGameState('singlePlayer')} 
        className="w-full text-lg py-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        Single Player
      </Button>
      <Button 
        onClick={() => setGameState('multiplayer')} 
        className="w-full text-lg py-6 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        Multiplayer
      </Button>
      <Button 
        onClick={() => setGameState('deckBuilder')} 
        className="w-full text-lg py-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        Deck Builder
      </Button>
      <Button 
        onClick={logout} 
        variant="outline" 
        className="w-full text-lg py-6 border-2 border-gray-300 hover:bg-gray-100 transition-all duration-300 shadow-lg"
      >
        Logout
      </Button>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200 flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-center mb-8">
          <Teddy className="w-12 h-12 text-pink-500 mr-4" />
          <h1 className="text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
            Terrible Teddies
          </h1>
        </div>
        {gameState === 'loading' && (
          <div className="text-center text-2xl text-gray-600">
            Loading game assets...
          </div>
        )}
        {gameState === 'menu' && renderMenu()}
        {(gameState === 'singlePlayer' || gameState === 'multiplayer') && (
          <GameBoard
            gameMode={gameState}
            onExit={() => setGameState('menu')}
          />
        )}
        {gameState === 'deckBuilder' && (
          <DeckBuilder onExit={() => setGameState('menu')} />
        )}
        {gameState === 'imageGenerator' && (
          <Card className="bg-gradient-to-r from-pink-100 to-purple-100">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-purple-700">Generate Game Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageGenerator onComplete={() => {
                setImagesGenerated(true);
                setGameState('menu');
              }} />
            </CardContent>
          </Card>
        )}
        {imagesGenerated && gameState === 'menu' && (
          <div className="text-center text-green-600 mb-4">
            All game assets have been generated successfully!
          </div>
        )}
      </div>
    </div>
  );
};

const Index = () => (
  <SupabaseAuthProvider>
    <IndexContent />
  </SupabaseAuthProvider>
);

export default Index;
