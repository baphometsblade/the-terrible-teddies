import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

const Profile = () => {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error.message}</div>;

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
            <div className="mt-4">
              <p><strong>Experience:</strong></p>
              <Progress value={(profile.experience % 100)} className="w-full" />
              <p className="text-sm text-gray-500">Level {Math.floor(profile.experience / 100) + 1}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Profile;