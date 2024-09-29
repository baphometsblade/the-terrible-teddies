import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from '../integrations/supabase/auth';

const Profile = () => {
  const { session, logout } = useSupabaseAuth();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!session?.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user,
  });

  if (isLoading) return <div className="text-center mt-8">Loading profile...</div>;
  if (error) return <div className="text-center mt-8">Error loading profile: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4 text-center text-purple-600">Player Profile</h1>
      {profile && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <h2 className="text-2xl font-bold">{profile.username || session.user.email}</h2>
          </CardHeader>
          <CardContent>
            <p className="mb-2">Wins: {profile.wins || 0}</p>
            <p className="mb-2">Losses: {profile.losses || 0}</p>
            <p className="mb-2">Coins: {profile.coins || 0}</p>
            <Button onClick={logout} className="mt-4">Sign Out</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Profile;