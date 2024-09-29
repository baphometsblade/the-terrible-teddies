import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const PlayerProfile = () => {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['playerProfile'],
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

  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">{profile.username}</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-semibold">Wins:</p>
          <p>{profile.wins}</p>
        </div>
        <div>
          <p className="font-semibold">Losses:</p>
          <p>{profile.losses}</p>
        </div>
        <div>
          <p className="font-semibold">Rank:</p>
          <p>{profile.rank}</p>
        </div>
        <div>
          <p className="font-semibold">Coins:</p>
          <p>{profile.coins}</p>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;