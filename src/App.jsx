import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BattleSystem from './components/Battle/BattleSystem';
import Evolution from './components/Evolution';
import TeddyDisplay from './components/TeddyDisplay';
import SeasonalEventManager from './components/SeasonalEvent/SeasonalEventManager';
import BattleStats from './components/BattleStats';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const queryClient = new QueryClient();

function App() {
  const [selectedTeddy, setSelectedTeddy] = useState(null);

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App p-4">
        <h1 className="text-4xl font-bold mb-4">Terrible Teddies</h1>
        <Tabs defaultValue="collection">
          <TabsList className="mb-4">
            <TabsTrigger value="collection">Collection</TabsTrigger>
            <TabsTrigger value="battle">Battle</TabsTrigger>
            <TabsTrigger value="evolution">Evolution</TabsTrigger>
            <TabsTrigger value="event">Seasonal Event</TabsTrigger>
            <TabsTrigger value="stats">Battle Stats</TabsTrigger>
          </TabsList>
          <TabsContent value="collection">
            <TeddyDisplay onSelect={handleTeddySelect} />
          </TabsContent>
          <TabsContent value="battle">
            {selectedTeddy ? (
              <BattleSystem
                playerTeddy={selectedTeddy}
                opponentTeddy={{ id: 2 }} // For now, we're using a hardcoded opponent
              />
            ) : (
              <p>Please select a teddy from your collection first.</p>
            )}
          </TabsContent>
          <TabsContent value="evolution">
            {selectedTeddy ? (
              <Evolution teddy={selectedTeddy} />
            ) : (
              <p>Please select a teddy from your collection first.</p>
            )}
          </TabsContent>
          <TabsContent value="event">
            <SeasonalEventManager />
          </TabsContent>
          <TabsContent value="stats">
            <BattleStats />
          </TabsContent>
        </Tabs>
      </div>
    </QueryClientProvider>
  );
}

export default App;