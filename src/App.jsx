import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import MainMenu from './components/MainMenu';
import BattleSystem from './components/Battle/BattleSystem';
import Evolution from './components/Evolution';
import TeddyDisplay from './components/TeddyDisplay';
import SeasonalEventManager from './components/SeasonalEvent/SeasonalEventManager';
import BattleStats from './components/BattleStats';
import Shop from './components/Shop';
import PlayerProfile from './components/PlayerProfile';
import LeaderboardComponent from './components/LeaderboardComponent';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import Auth from './components/Auth';

const queryClient = new QueryClient();

function App() {
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const { session } = useSupabaseAuth();

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
          <Routes>
            <Route path="/" element={<MainMenu />} />
            <Route path="/battle" element={<BattleSystem playerTeddy={selectedTeddy} />} />
            <Route path="/evolution" element={<Evolution teddy={selectedTeddy} />} />
            <Route path="/collection" element={<TeddyDisplay onSelect={handleTeddySelect} />} />
            <Route path="/event" element={<SeasonalEventManager />} />
            <Route path="/stats" element={<BattleStats />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/profile" element={<PlayerProfile />} />
            <Route path="/leaderboard" element={<LeaderboardComponent />} />
          </Routes>
        </div>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;