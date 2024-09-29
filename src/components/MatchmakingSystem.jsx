import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";

const MatchmakingSystem = ({ onMatchFound }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [matchmakingChannel, setMatchmakingChannel] = useState(null);
  const { session } = useSupabaseAuth();

  useEffect(() => {
    if (isSearching) {
      const channel = supabase.channel('matchmaking');
      setMatchmakingChannel(channel);

      channel
        .on('broadcast', { event: 'match_found' }, ({ payload }) => {
          if (payload.player1Id === session.user.id || payload.player2Id === session.user.id) {
            setIsSearching(false);
            onMatchFound(payload);
          }
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [isSearching, session, onMatchFound]);

  const startMatchmaking = async () => {
    setIsSearching(true);
    await supabase.rpc('join_matchmaking', { player_id: session.user.id });
  };

  const cancelMatchmaking = async () => {
    setIsSearching(false);
    await supabase.rpc('leave_matchmaking', { player_id: session.user.id });
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