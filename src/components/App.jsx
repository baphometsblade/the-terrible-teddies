import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MainMenu } from './MainMenu';
import { GameBoard } from './GameBoard/GameBoard';
import { DeckBuilder } from './DeckBuilder';
import { CardShop } from './CardShop';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState('menu');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'game':
        return <GameBoard onExit={() => setCurrentScreen('menu')} />;
      case 'deckBuilder':
        return <DeckBuilder onExit={() => setCurrentScreen('menu')} />;
      case 'cardShop':
        return <CardShop onExit={() => setCurrentScreen('menu')} />;
      default:
        return <MainMenu onScreenChange={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 flex flex-col items-center justify-center text-white p-4">
      {renderScreen()}
    </div>
  );
};

export default App;
