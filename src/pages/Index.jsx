import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { GameBoard } from '../components/GameBoard/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { CardShop } from '../components/CardShop';
import { LeaderboardComponent } from '../components/LeaderboardComponent';

const Index = () => {
  const [currentView, setCurrentView] = useState('menu');

  const renderContent = () => {
    switch (currentView) {
      case 'game':
        return <GameBoard onExit={() => setCurrentView('menu')} />;
      case 'deckBuilder':
        return <DeckBuilder onExit={() => setCurrentView('menu')} />;
      case 'cardShop':
        return <CardShop onExit={() => setCurrentView('menu')} />;
      case 'leaderboard':
        return <LeaderboardComponent />;
      default:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold text-purple-800 mb-8">Welcome to Terrible Teddies!</h1>
            <div className="space-y-4">
              <Button onClick={() => setCurrentView('game')} className="w-full">Start Game</Button>
              <Button onClick={() => setCurrentView('deckBuilder')} className="w-full">Deck Builder</Button>
              <Button onClick={() => setCurrentView('cardShop')} className="w-full">Card Shop</Button>
              <Button onClick={() => setCurrentView('leaderboard')} className="w-full">Leaderboard</Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="container mx-auto p-4">
      {renderContent()}
      {currentView !== 'menu' && (
        <Button onClick={() => setCurrentView('menu')} className="mt-4">
          Back to Menu
        </Button>
      )}
    </div>
  );
};

export default Index;
