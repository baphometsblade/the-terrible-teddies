import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { SupabaseAuthProvider } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameBoard } from '../components/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { ImageGenerator } from '../components/ImageGenerator';
import { Bear } from 'lucide-react';

const IndexContent = () => {
  const { session, loading: authLoading, logout } = useSupabaseAuth();
  const [gameState, setGameState] = useState('loading'); // 'loading', 'menu', 'singlePlayer', 'multiplayer', 'deckBuilder', 'imageGenerator'
  const [imagesGenerated, setImagesGenerated] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      setGameState('imageGenerator');
    }
  }, [authLoading, session]);

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Welcome to Terrible Teddies</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Please sign in to start playing.</p>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderMenu = () => (
    <div className="space-y-6">
      <Button 
        onClick={() => setGameState('singlePlayer')} 
        className="w-full text-lg py-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
      >
        Single Player
      </Button>
      <Button 
        onClick={() => setGameState('multiplayer')} 
        className="w-full text-lg py-6 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 transition-all duration-300 transform hover:scale-105"
      >
        Multiplayer
      </Button>
      <Button 
        onClick={() => setGameState('deckBuilder')} 
        className="w-full text-lg py-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105"
      >
        Deck Builder
      </Button>
      <Button 
        onClick={logout} 
        variant="outline" 
        className="w-full text-lg py-6 border-2 border-gray-300 hover:bg-gray-100 transition-all duration-300"
      >
        Logout
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200 flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-center mb-8">
          <Bear className="w-12 h-12 text-pink-500 mr-4" />
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
              <CardTitle className="text-2xl text-center text-purple-700">Generating Game Assets</CardTitle>
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
