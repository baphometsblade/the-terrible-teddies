import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const PlayerProfile = () => {
  const [profile, setProfile] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Logout Failed",
        description: "An error occurred while logging out. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
        variant: "success",
      });
    }
  };

  if (!profile) {
    return <div>Loading profile...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Player Profile</h2>
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <p className="mb-2"><strong>Username:</strong> {profile.username}</p>
        <p className="mb-2"><strong>Email:</strong> {profile.email}</p>
        <p className="mb-2"><strong>Coins:</strong> {profile.coins}</p>
        <p className="mb-2"><strong>Wins:</strong> {profile.wins}</p>
        <p className="mb-2"><strong>Losses:</strong> {profile.losses}</p>
        <Button onClick={handleLogout} className="mt-4">Logout</Button>
      </div>
    </div>
  );
};

export default PlayerProfile;