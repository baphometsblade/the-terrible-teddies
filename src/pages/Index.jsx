import React, { useState } from 'react';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fetchGameData = async () => {
  const { data, error } = await supabase.from('generated_images').select('*');
  if (error) throw error;
  return data;
};

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const { data: gameData, isLoading, error } = useQuery({
    queryKey: ['gameData'],
    queryFn: fetchGameData,
  });

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
      {!gameStarted ? (
        <MainMenu onStartGame={() => setGameStarted(true)} />
      ) : (
        <GameBoard onExitGame={() => setGameStarted(false)} gameData={gameData} />
      )}
    </div>
  );
};

export default Index;
