import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";

const PlayerProfile = () => {
  const { session } = useSupabaseAuth();

  const { data: playerData, isLoading: playerLoading, error: playerError } = useQuery({
    queryKey: ['playerProfile', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: playerTeddies, isLoading: teddiesLoading, error: teddiesError } = useQuery({
    queryKey: ['playerTeddies', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', session.user.id);
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
    enabled: !!session?.user?.id,
  });

  if (playerLoading || teddiesLoading) return <div>Loading profile...</div>;
  if (playerError || teddiesError) return <div>Error: {playerError?.message || teddiesError?.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Player Profile</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-2">Player Info</h2>
          <p><strong>Username:</strong> {playerData.username}</p>
          <p><strong>Rank:</strong> {playerData.rank}</p>
          <p><strong>Wins:</strong> {playerData.wins}</p>
          <p><strong>Losses:</strong> {playerData.losses}</p>
          <p><strong>Coins:</strong> {playerData.coins}</p>
          <Button className="mt-4">Edit Profile</Button>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Teddy Collection</h2>
          <div className="grid grid-cols-2 gap-4">
            {playerTeddies.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;