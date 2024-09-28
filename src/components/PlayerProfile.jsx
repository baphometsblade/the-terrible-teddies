import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const PlayerProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          if (error.code === '42P01') {
            // Table doesn't exist, create it
            await setupDatabase();
            // Retry fetching the profile
            await fetchProfile();
          } else {
            throw error;
          }
        } else if (!data) {
          // Player profile doesn't exist, create a new one
          const newProfile = {
            id: user.id,
            username: user.email.split('@')[0],
            email: user.email,
            coins: 0,
            wins: 0,
            losses: 0
          };
          const { data: createdProfile, error: createError } = await supabase
            .from('players')
            .insert(newProfile)
            .single();
          
          if (createError) throw createError;
          setProfile(createdProfile);
        } else {
          setProfile(data);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile. Please try again later.');
      toast({
        title: "Error",
        description: "Failed to load profile. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
        variant: "success",
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Logout Failed",
        description: "An error occurred while logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) return <div className="text-center mt-8">Loading profile...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Player Profile</h2>
      {profile ? (
        <Card className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <CardHeader>
            <h3 className="text-xl font-semibold">{profile.username}</h3>
          </CardHeader>
          <CardContent>
            <p className="mb-2"><strong>Email:</strong> {profile.email}</p>
            <p className="mb-2"><strong>Coins:</strong> {profile.coins}</p>
            <p className="mb-2"><strong>Wins:</strong> {profile.wins}</p>
            <p className="mb-2"><strong>Losses:</strong> {profile.losses}</p>
            <Button onClick={handleLogout} className="mt-4">Logout</Button>
          </CardContent>
        </Card>
      ) : (
        <p>No profile data available.</p>
      )}
    </div>
  );
};

export default PlayerProfile;