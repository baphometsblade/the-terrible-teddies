import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const Leaderboard = () => {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, username, wins, losses')
        .order('wins', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading leaderboard...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="px-4 py-2">Rank</th>
            <th className="px-4 py-2">Username</th>
            <th className="px-4 py-2">Wins</th>
            <th className="px-4 py-2">Losses</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={player.id} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
              <td className="px-4 py-2">{index + 1}</td>
              <td className="px-4 py-2">{player.username}</td>
              <td className="px-4 py-2">{player.wins}</td>
              <td className="px-4 py-2">{player.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;