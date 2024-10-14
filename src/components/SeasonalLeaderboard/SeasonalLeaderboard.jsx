import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SeasonalLeaderboard = () => {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['seasonalLeaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasonal_leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading Seasonal Leaderboard...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <motion.div
      className="seasonal-leaderboard bg-gray-100 p-4 rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Seasonal Leaderboard</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Wins</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboard.map((entry, index) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell>{entry.player_name}</TableCell>
              <TableCell>{entry.score}</TableCell>
              <TableCell>{entry.wins}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  );
};

export default SeasonalLeaderboard;