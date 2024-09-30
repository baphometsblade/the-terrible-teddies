import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import Home from './components/Home';
import Header from './components/Header';
import BattleArena from './components/BattleArena/BattleArena';
import Auth from './components/Auth';
import TeddyCollection from './components/TeddyCollection';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import PlayerProfile from './components/PlayerProfile';
import DailyChallenge from './components/DailyChallenge';
import Battle from './components/Battle';

function App() {
  const [selectedTeddy, setSelectedTeddy] = useState(null);

  return (
    <Router>
      <div className="App bg-gray-100 min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/battle" element={<BattleArena />} />
          <Route path="/auth" element={<Auth />} />
          <Route 
            path="/collection" 
            element={<TeddyCollection onSelectTeddy={setSelectedTeddy} />} 
          />
          <Route path="/shop" element={<Shop />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<PlayerProfile />} />
          <Route path="/daily-challenge" element={<DailyChallenge />} />
          {selectedTeddy && (
            <Route 
              path="/battle" 
              element={
                <Battle 
                  playerTeddy={selectedTeddy} 
                  opponentTeddy={selectedTeddy} // For now, we're using the same teddy as opponent
                  onBattleEnd={(result) => console.log(`Battle ended with result: ${result}`)}
                />
              } 
            />
          )}
        </Routes>
      </div>
      <Toaster />
    </Router>
  );
}

export default App;