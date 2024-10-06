import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import Battle from './Battle/Battle';
import Shop from './Shop';
import DailyChallenge from './DailyChallenge';
import BearEvolution from './BearEvolution';
import PlayerProfile from './PlayerProfile';
import LeaderboardComponent from './LeaderboardComponent';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { captureEvent } from '../utils/posthog';

const Game = () => {
  const [gameState, setGameState] = useState('menu');
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const { toast } = useToast();

  const { data: playerTeddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', user.id);
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
  });

  useEffect(() => {
    if (playerTeddies && playerTeddies.length > 0) {
      setSelectedTeddy(playerTeddies[0]);
    }
  }, [playerTeddies]);

  const handleBattleEnd = (result) => {
    setGameState('menu');
    toast({
      title: result === 'win' ? "Victory!" : "Defeat",
      description: result === 'win' ? "You won the battle!" : "You lost the battle.",
      variant: result === 'win' ? "success" : "destructive",
    });
    captureEvent('Battle_Ended', { result });
  };

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const renderGameContent = () => {
    switch (gameState) {
      case 'battle':
        return (
          <Battle
            playerTeddy={selectedTeddy}
            opponentTeddy={playerTeddies[Math.floor(Math.random() * playerTeddies.length)]}
            onBattleEnd={handleBattleEnd}
          />
        );
      case 'shop':
        return <Shop />;
      case 'challenge':
        return <DailyChallenge />;
      case 'evolution':
        return <BearEvolution teddy={selectedTeddy} />;
      case 'profile':
        return <PlayerProfile />;
      case 'leaderboard':
        return <LeaderboardComponent />;
      default:
        return (
          <div className="menu flex flex-col space-y-4">
            <Button onClick={() => {
              setGameState('battle');
              captureEvent('Battle_Started');
            }}>Start Battle</Button>
            <Button onClick={() => {
              setGameState('shop');
              captureEvent('Shop_Opened');
            }}>Visit Shop</Button>
            <Button onClick={() => {
              setGameState('challenge');
              captureEvent('Daily_Challenge_Started');
            }}>Daily Challenge</Button>
            <Button onClick={() => {
              setGameState('evolution');
              captureEvent('Evolution_Started');
            }} disabled={!selectedTeddy}>Evolve Teddy</Button>
            <Button onClick={() => {
              setGameState('profile');
              captureEvent('Profile_Viewed');
            }}>View Profile</Button>
            <Button onClick={() => {
              setGameState('leaderboard');
              captureEvent('Leaderboard_Viewed');
            }}>Leaderboard</Button>
          </div>
        );
    }
  };

  return (
    <div className="game-container p-4 bg-gray-100 rounded-lg">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
      {renderGameContent()}
      {gameState !== 'menu' && (
        <Button onClick={() => setGameState('menu')} className="mt-4">
          Back to Menu
        </Button>
      )}
    </div>
  );
};

export default Game;