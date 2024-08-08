import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { SupabaseAuthProvider } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameBoard } from '../components/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { ImageGenerator } from '../components/ImageGenerator';

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
    <div className="space-y-4">
      <Button onClick={() => setGameState('singlePlayer')} className="w-full">Single Player</Button>
      <Button onClick={() => setGameState('multiplayer')} className="w-full">Multiplayer</Button>
      <Button onClick={() => setGameState('deckBuilder')} className="w-full">Deck Builder</Button>
      <Button onClick={logout} variant="outline" className="w-full">Logout</Button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
      {gameState === 'loading' && <div className="text-center">Loading game assets...</div>}
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
        <Card>
          <CardHeader>
            <CardTitle>Generating Game Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageGenerator onComplete={() => {
              setImagesGenerated(true);
              setGameState('menu');
            }} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Index = () => (
  <SupabaseAuthProvider>
    <IndexContent />
  </SupabaseAuthProvider>
);

export default Index;
