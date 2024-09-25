import React, { useState, useEffect } from 'react';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard/GameBoard';
import { AssetGenerator } from '../components/AssetGenerator';
import { LeaderboardComponent } from '../components/LeaderboardComponent';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';

const fetchGameData = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
  if (error) throw error;
  return data;
};

const Index = () => {
  const [gameState, setGameState] = useState('menu');
  const [assetsGenerated, setAssetsGenerated] = useState(false);
  const { data: gameData, isLoading, error } = useQuery({
    queryKey: ['gameData'],
    queryFn: fetchGameData,
  });

  useEffect(() => {
    if (gameData && gameData.length > 0) {
      setAssetsGenerated(true);
    }
  }, [gameData]);

  const handleStartGame = () => setGameState('playing');
  const handleReturnToMenu = () => setGameState('menu');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading game data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white flex items-center justify-center">
        <p className="text-red-500">Error loading game data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-8">
      {!assetsGenerated ? (
        <AssetGenerator onComplete={() => setAssetsGenerated(true)} />
      ) : gameState === 'menu' ? (
        <div>
          <MainMenu onStartGame={handleStartGame} />
          <div className="mt-8">
            <LeaderboardComponent />
          </div>
        </div>
      ) : (
        <GameBoard onExitGame={handleReturnToMenu} gameData={gameData} />
      )}
    </div>
  );
};

export default Index;
