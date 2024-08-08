import { useState } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { session, loading, logout } = useSupabaseAuth();
  const [gameState, setGameState] = useState('menu'); // 'menu', 'game', 'deckBuilder'

  if (loading) {
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
      <Button onClick={() => setGameState('game')} className="w-full">Single Player</Button>
      <Button onClick={() => setGameState('game')} className="w-full">Multiplayer</Button>
      <Button onClick={() => setGameState('deckBuilder')} className="w-full">Deck Builder</Button>
      <Button onClick={logout} variant="outline" className="w-full">Logout</Button>
    </div>
  );

  const renderGame = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Game in Progress</h2>
      <p>Game mechanics will be implemented here.</p>
      <Button onClick={() => setGameState('menu')} className="mt-4">Back to Menu</Button>
    </div>
  );

  const renderDeckBuilder = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Deck Builder</h2>
      <p>Deck building interface will be implemented here.</p>
      <Button onClick={() => setGameState('menu')} className="mt-4">Back to Menu</Button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Terrible Teddies</h1>
      {gameState === 'menu' && renderMenu()}
      {gameState === 'game' && renderGame()}
      {gameState === 'deckBuilder' && renderDeckBuilder()}
    </div>
  );
};

export default Index;
