import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Leaderboard = () => {
  const { data: leaderboard, isLoading, error } = useQuery({
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

  if (isLoading) return <div>Loading leaderboard...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Leaderboard</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Wins</TableHead>
            <TableHead>Losses</TableHead>
            <TableHead>Win Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboard.map((player, index) => (
            <TableRow key={player.id}>
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell className="flex items-center">
                <Avatar className="mr-2">
                  <AvatarImage src={player.avatar_url} alt={player.username} />
                  <AvatarFallback>{player.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                {player.username}
              </TableCell>
              <TableCell>{player.wins}</TableCell>
              <TableCell>{player.losses}</TableCell>
              <TableCell>
                {player.wins + player.losses > 0
                  ? `${((player.wins / (player.wins + player.losses)) * 100).toFixed(2)}%`
                  : 'N/A'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Leaderboard;