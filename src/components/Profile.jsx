import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetchUserProfile = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

const Profile = () => {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['user-profile'],
    queryFn: fetchUserProfile,
  });

  if (isLoading) return <div className="text-center mt-8">Loading profile...</div>;
  if (error) return <div className="text-center mt-8">Error loading profile: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-4 text-center">Player Profile</h2>
      <Card>
        <CardHeader>
          <CardTitle>{profile.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Rank: {profile.rank}</p>
          <p>Wins: {profile.wins}</p>
          <p>Losses: {profile.losses}</p>
          <p>Coins: {profile.coins}</p>
          <h3 className="text-xl font-bold mt-4 mb-2">Achievements</h3>
          <ul>
            {profile.achievements && profile.achievements.map((achievement, index) => (
              <li key={index}>{achievement}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;