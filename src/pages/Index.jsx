import React, { useState } from 'react';
import { Header } from '../components/Header';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard/GameBoard';
import { AssetGenerator } from '../components/AssetGenerator';
import { CardShop } from '../components/CardShop';
import { DeckBuilder } from '../components/DeckBuilder';
import { LeaderboardComponent } from '../components/LeaderboardComponent';

const Index = () => {
  const [currentView, setCurrentView] = useState('menu');
  const [assetsGenerated, setAssetsGenerated] = useState(false);

  const handleAssetGenerationComplete = () => {
    setAssetsGenerated(true);
    setCurrentView('menu');
  };

  const renderView = () => {
    switch (currentView) {
      case 'game':
        return <GameBoard onExit={() => setCurrentView('menu')} />;
      case 'shop':
        return <CardShop onExit={() => setCurrentView('menu')} />;
      case 'deck':
        return <DeckBuilder onExit={() => setCurrentView('menu')} />;
      case 'leaderboard':
        return <LeaderboardComponent onExit={() => setCurrentView('menu')} />;
      case 'assets':
        return <AssetGenerator onComplete={handleAssetGenerationComplete} />;
      default:
        return (
          <MainMenu
            onStartGame={() => setCurrentView('game')}
            onOpenShop={() => setCurrentView('shop')}
            onOpenDeckBuilder={() => setCurrentView('deck')}
            onOpenLeaderboard={() => setCurrentView('leaderboard')}
            onGenerateAssets={() => setCurrentView('assets')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {renderView()}
      </main>
    </div>
  );
};

export default Index;
