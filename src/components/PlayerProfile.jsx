import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';

const PlayerProfile = () => {
  const { data: player, isLoading, error } = useQuery({
    queryKey: ['playerProfile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*, player_teddies(*)') // Assuming we have a player_teddies table
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="player-profile container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Player Profile</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Stats</h2>
          <p>Username: {player.username}</p>
          <p>Rank: {player.rank}</p>
          <p>Wins: {player.wins}</p>
          <p>Losses: {player.losses}</p>
          <p>Coins: {player.coins}</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Teddies</h2>
          <div className="grid grid-cols-2 gap-2">
            {player.player_teddies.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;