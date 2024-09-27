import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Leaderboard = () => {
  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('wins', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center mt-8">Loading leaderboard...</div>;
  if (error) return <div className="text-center mt-8">Error loading leaderboard: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Wins</TableHead>
            <TableHead>Losses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboardData && leaderboardData.map((player, index) => (
            <TableRow key={player.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{player.username}</TableCell>
              <TableCell>{player.wins}</TableCell>
              <TableCell>{player.losses}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Leaderboard;