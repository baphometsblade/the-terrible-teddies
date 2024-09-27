import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import GameBoard from './components/GameBoard';
import Shop from './components/Shop';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<GameBoard />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;