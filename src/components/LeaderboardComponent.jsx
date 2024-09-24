import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const fetchLeaderboard = async () => {
  const { data, error } = await supabase
    .from('user_stats')
    .select('username, games_won, games_played')
    .order('games_won', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data;
};

export const LeaderboardComponent = () => {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
  });

  if (isLoading) return <div>Loading leaderboard...</div>;
  if (error) return <div>Error loading leaderboard: {error.message}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Rank</th>
            <th className="text-left">Username</th>
            <th className="text-left">Wins</th>
            <th className="text-left">Games Played</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={player.username}>
              <td>{index + 1}</td>
              <td>{player.username}</td>
              <td>{player.games_won}</td>
              <td>{player.games_played}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
