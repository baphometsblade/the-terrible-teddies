import React, { useState } from 'react';
import { Header } from '../components/Header';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard';
import { Background } from '../components/Background';

const Index = () => {
  const [currentView, setCurrentView] = useState('menu');

  const renderView = () => {
    switch (currentView) {
      case 'game':
        return <GameBoard onExit={() => setCurrentView('menu')} />;
      default:
        return <MainMenu onStartGame={() => setCurrentView('game')} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Background />
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 relative z-10">
        {renderView()}
      </main>
    </div>
  );
};

export default Index;
