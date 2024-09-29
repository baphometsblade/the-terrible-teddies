import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const MatchmakingSystem = ({ onMatchFound }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [matchmakingChannel, setMatchmakingChannel] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isSearching) {
      const channel = supabase.channel('matchmaking');
      setMatchmakingChannel(channel);

      channel
        .on('broadcast', { event: 'match_found' }, ({ payload }) => {
          setIsSearching(false);
          onMatchFound(payload);
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [isSearching, onMatchFound]);

  const startMatchmaking = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to start matchmaking.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    const { error } = await supabase.rpc('join_matchmaking', { player_id: user.id });
    if (error) {
      console.error('Error joining matchmaking:', error);
      setIsSearching(false);
      toast({
        title: "Matchmaking Error",
        description: "An error occurred while joining matchmaking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const cancelMatchmaking = async () => {
    setIsSearching(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.rpc('leave_matchmaking', { player_id: user.id });
    }
  };

  return (
    <div className="text-center">
      {!isSearching ? (
        <Button onClick={startMatchmaking}>Find Match</Button>
      ) : (
        <>
          <p className="mb-4">Searching for opponent...</p>
          <Button onClick={cancelMatchmaking} variant="secondary">Cancel</Button>
        </>
      )}
    </div>
  );
};

export default MatchmakingSystem;