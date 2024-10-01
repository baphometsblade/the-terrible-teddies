import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import TeddyCard from './TeddyCard';

const PlayerProfile = () => {
  const { data: player, isLoading: playerLoading, error: playerError } = useQuery({
    queryKey: ['player'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: playerTeddies, isLoading: teddiesLoading, error: teddiesError } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', user.id);
      if (error) throw error;
      return data;
    },
  });

  if (playerLoading || teddiesLoading) return <div>Loading profile...</div>;
  if (playerError || teddiesError) return <div>Error loading profile</div>;

  return (
    <div className="player-profile p-4 bg-gray-100 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Player Profile</h2>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{player.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Rank: {player.rank}</p>
          <p>Coins: {player.coins}</p>
          <p>Wins: {player.wins}</p>
          <p>Losses: {player.losses}</p>
          <div className="mt-4">
            <p>Win Rate</p>
            <Progress value={(player.wins / (player.wins + player.losses)) * 100} className="w-full" />
          </div>
        </CardContent>
      </Card>
      <h3 className="text-xl font-bold mb-4">Your Teddies</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {playerTeddies.map(({ terrible_teddies: teddy }) => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};

export default PlayerProfile;