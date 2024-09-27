import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const Profile = () => {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error loading profile: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Player Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>{profile.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Rank: {profile.rank}</p>
          <p>Wins: {profile.wins}</p>
          <p>Losses: {profile.losses}</p>
          <p>Favorite Bear: {profile.favorite_bear}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;