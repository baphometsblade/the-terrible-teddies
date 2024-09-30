import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import Home from './components/Home';
import Battle from './components/Battle';
import TeddyCollection from './components/TeddyCollection';
import Shop from './components/Shop';
import Header from './components/Header';
import PlayerProfile from './components/PlayerProfile';
import Leaderboard from './components/Leaderboard';
import PlayerSubmission from './components/PlayerSubmission';
import BearEvolution from './components/BearEvolution';

function App() {
  return (
    <Router>
      <div className="App bg-gray-100 min-h-screen">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/battle" element={<Battle />} />
          <Route path="/collection" element={<TeddyCollection />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/profile" element={<PlayerProfile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/submit" element={<PlayerSubmission />} />
          <Route path="/evolve/:teddyId" element={<BearEvolution />} />
        </Routes>
      </div>
      <Toaster />
    </Router>
  );
}

export default App;