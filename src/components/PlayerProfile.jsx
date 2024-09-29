import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PlayerProfile = () => {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      
      const { data, error } = await supabase
        .from('profiles')
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
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Player Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <Avatar>
            <AvatarImage src={profile.avatar_url} alt={profile.username} />
            <AvatarFallback>{profile.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">{profile.username}</h2>
            <p className="text-gray-500">Rank: {profile.rank}</p>
          </div>
        </div>
        <div className="mt-4">
          <p>Wins: {profile.wins}</p>
          <p>Losses: {profile.losses}</p>
          <p>Teddies Collected: {profile.teddies_collected}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerProfile;