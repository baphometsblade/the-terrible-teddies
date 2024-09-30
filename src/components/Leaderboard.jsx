import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Leaderboard = () => {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, username, rank, wins, losses')
        .order('wins', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading leaderboard...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="leaderboard container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Leaderboard</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Wins</TableHead>
            <TableHead>Losses</TableHead>
            <TableHead>Win Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboard.map((player, index) => (
            <TableRow key={player.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{player.username}</TableCell>
              <TableCell>{player.wins}</TableCell>
              <TableCell>{player.losses}</TableCell>
              <TableCell>
                {((player.wins / (player.wins + player.losses)) * 100).toFixed(2)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Leaderboard;