import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";

const Profile = () => {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center mt-8">Loading profile...</div>;
  if (error) return <div className="text-center mt-8">Error loading profile: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4 text-center text-purple-600">Player Profile</h1>
      {profile && (
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-2">{profile.username}</h2>
          <p className="mb-2">Wins: {profile.wins}</p>
          <p className="mb-2">Losses: {profile.losses}</p>
          <p className="mb-2">Coins: {profile.coins}</p>
          <Button onClick={() => supabase.auth.signOut()}>Sign Out</Button>
        </div>
      )}
    </div>
  );
};

export default Profile;