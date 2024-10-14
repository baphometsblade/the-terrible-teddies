import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BattleSystem from './components/Battle/BattleSystem';
import EvolutionSystem from './components/Evolution/EvolutionSystem';
import TeddyDisplay from './components/TeddyDisplay';
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function App() {
  const [currentView, setCurrentView] = useState('collection');
  const [selectedTeddy, setSelectedTeddy] = useState(null);

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App p-4">
        <h1 className="text-4xl font-bold mb-4">Terrible Teddies</h1>
        <div className="mb-4">
          <Button onClick={() => setCurrentView('collection')} className="mr-2">Collection</Button>
          <Button onClick={() => setCurrentView('battle')} className="mr-2">Battle</Button>
          <Button onClick={() => setCurrentView('evolution')}>Evolution</Button>
        </div>
        {currentView === 'collection' && (
          <TeddyDisplay onSelect={handleTeddySelect} />
        )}
        {currentView === 'battle' && selectedTeddy && (
          <BattleSystem
            playerTeddy={selectedTeddy}
            opponentTeddy={{ id: 2 }} // For now, we're using a hardcoded opponent
          />
        )}
        {currentView === 'evolution' && selectedTeddy && (
          <EvolutionSystem teddyId={selectedTeddy.id} />
        )}
      </div>
    </QueryClientProvider>
  );
}

export default App;