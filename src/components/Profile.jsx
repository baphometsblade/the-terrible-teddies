import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Profile = () => {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center mt-8">Loading profile...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">Error loading profile: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Player Profile</h1>
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Avatar className="mr-4">
                <AvatarImage src={profile.avatar_url} alt={profile.username} />
                <AvatarFallback>{profile.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {profile.username}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>Rank:</strong> {profile.rank}</p>
            <p><strong>Wins:</strong> {profile.wins}</p>
            <p><strong>Losses:</strong> {profile.losses}</p>
            <p><strong>Coins:</strong> {profile.coins}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Profile;