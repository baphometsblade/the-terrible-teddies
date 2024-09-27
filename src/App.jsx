import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import GameBoard from './components/GameBoard';
import Shop from './components/Shop';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';
import TeddyCollection from './components/TeddyCollection';
import UserSubmission from './components/UserSubmission';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<GameBoard />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/collection" element={<TeddyCollection />} />
        <Route path="/submit" element={<UserSubmission />} />
      </Routes>
    </div>
  );
}

export default App;