import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import GameBoard from './components/GameBoard';
import Header from './components/Header';
import Shop from './components/Shop';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';

function App() {
  const [currentView, setCurrentView] = useState('game');

  const renderView = () => {
    switch (currentView) {
      case 'game':
        return <GameBoard />;
      case 'shop':
        return <Shop />;
      case 'profile':
        return <Profile />;
      case 'leaderboard':
        return <Leaderboard />;
      default:
        return <GameBoard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
      <Header setCurrentView={setCurrentView} />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center text-purple-300">Terrible Teddies</h1>
        {renderView()}
      </main>
    </div>
  );
}

export default App;