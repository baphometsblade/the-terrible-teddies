import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameBoard } from '../components/GameBoard/GameBoard';
import { DeckBuilder } from '../components/DeckBuilder';
import { LeaderboardComponent } from '../components/LeaderboardComponent';
import { CardShop } from '../components/CardShop';
import { AssetGenerator } from '../components/AssetGenerator';
import { Auth } from '../components/Auth';
import { PawPrint, Settings, Trophy, Book, ShoppingBag, LogOut } from 'lucide-react';
import { useGeneratedImages } from '../integrations/supabase';
import { supabase } from '../lib/supabase';

const Index = () => {
  const [currentView, setCurrentView] = useState('menu');
  const [gameMode, setGameMode] = useState('singlePlayer');
  const [difficulty, setDifficulty] = useState('normal');
  const [session, setSession] = useState(null);
  const { data: generatedImages, isLoading, refetch } = useGeneratedImages();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  useEffect(() => {
    if (!generatedImages || generatedImages.length === 0) {
      setCurrentView('assetGenerator');
    }
  }, [generatedImages]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  }

  const renderContent = () => {
    if (!session) {
      return <Auth />;
    }

    switch (currentView) {
      case 'assetGenerator':
        return <AssetGenerator onComplete={() => { refetch(); setCurrentView('menu'); }} />;
      case 'game':
        return <GameBoard onExit={() => setCurrentView('menu')} gameMode={gameMode} difficulty={difficulty} />;
      case 'deckBuilder':
        return <DeckBuilder onExit={() => setCurrentView('menu')} />;
      case 'leaderboard':
        return <LeaderboardComponent />;
      case 'cardShop':
        return <CardShop onExit={() => setCurrentView('menu')} />;
      default:
        return (
          <div className="text-center">
            <h2 className="text-4xl font-bold text-red-800 mb-8">Welcome to Terrible Teddies!</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <Button onClick={() => setCurrentView('game')} className="bg-red-600 hover:bg-red-700 text-white text-lg py-6">
                <PawPrint className="w-6 h-6 mr-2" />
                Start Brawl
              </Button>
              <Button onClick={() => setCurrentView('deckBuilder')} className="bg-blue-600 hover:bg-blue-700 text-white text-lg py-6">
                <Book className="w-6 h-6 mr-2" />
                Build Your Team
              </Button>
              <Button onClick={() => setCurrentView('leaderboard')} className="bg-yellow-600 hover:bg-yellow-700 text-white text-lg py-6">
                <Trophy className="w-6 h-6 mr-2" />
                Leaderboard
              </Button>
              <Button onClick={() => setCurrentView('cardShop')} className="bg-green-600 hover:bg-green-700 text-white text-lg py-6">
                <ShoppingBag className="w-6 h-6 mr-2" />
                Teddy Shop
              </Button>
              <Button onClick={() => setCurrentView('settings')} className="bg-purple-600 hover:bg-purple-700 text-white text-lg py-6">
                <Settings className="w-6 h-6 mr-2" />
                Game Settings
              </Button>
              <Button onClick={handleSignOut} className="bg-gray-600 hover:bg-gray-700 text-white text-lg py-6">
                <LogOut className="w-6 h-6 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        );
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-100 to-purple-200 flex items-center justify-center">
      <div className="container mx-auto p-8 max-w-4xl bg-white rounded-lg shadow-xl">
        <header className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <PawPrint className="w-24 h-24 mx-auto text-red-600" />
          </motion.div>
          <h1 className="text-5xl font-bold text-red-800 mt-6 mb-2">Terrible Teddies</h1>
          <p className="text-2xl text-red-600">The Ultimate Ultra-Realistic Brawler!</p>
        </header>
        {renderContent()}
        {currentView !== 'menu' && currentView !== 'assetGenerator' && session && (
          <Button onClick={() => setCurrentView('menu')} className="mt-8 bg-gray-600 hover:bg-gray-700 text-white">
            Back to Main Menu
          </Button>
        )}
      </div>
    </div>
  );
};

export default Index;
