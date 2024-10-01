import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import TeddyCard from './components/TeddyCard';
import Battle from './components/Battle';
import BearEvolution from './components/BearEvolution';
import Shop from './components/Shop';

const queryClient = new QueryClient();

function App() {
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [gameState, setGameState] = useState('collection'); // 'collection', 'battle', 'evolution', 'shop'

  const dummyTeddy = {
    id: 1,
    name: "Whiskey Whiskers",
    title: "The Smooth Operator",
    description: "A suave bear with a penchant for fine spirits and even finer company.",
    attack: 6,
    defense: 5,
    specialMove: "On the Rocks",
    specialMoveDescription: "Lowers the opponent's defense by 2 with his intoxicating charisma.",
    imageUrl: "https://example.com/whiskey-whiskers.jpg",
  };

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
  };

  const handleBattleEnd = (result) => {
    // Handle battle end logic here
    setGameState('collection');
  };

  const handleEvolve = (evolvedTeddy) => {
    setSelectedTeddy(evolvedTeddy);
    setGameState('collection');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
        {gameState === 'collection' && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Collection</h2>
            <div className="flex space-x-4 mb-4">
              <TeddyCard teddy={dummyTeddy} onClick={() => handleTeddySelect(dummyTeddy)} />
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setGameState('battle')} className="px-4 py-2 bg-blue-500 text-white rounded">Battle</button>
              <button onClick={() => setGameState('evolution')} className="px-4 py-2 bg-green-500 text-white rounded">Evolve</button>
              <button onClick={() => setGameState('shop')} className="px-4 py-2 bg-purple-500 text-white rounded">Shop</button>
            </div>
          </div>
        )}
        {gameState === 'battle' && selectedTeddy && (
          <Battle 
            playerTeddy={selectedTeddy} 
            opponentTeddy={dummyTeddy} 
            onBattleEnd={handleBattleEnd} 
          />
        )}
        {gameState === 'evolution' && selectedTeddy && (
          <BearEvolution teddy={selectedTeddy} onEvolve={handleEvolve} />
        )}
        {gameState === 'shop' && (
          <Shop />
        )}
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;