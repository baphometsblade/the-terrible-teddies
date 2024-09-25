import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
    const subscription = supabase
      .from('players')
      .on('UPDATE', payload => {
        setLeaderboard(currentLeaderboard => 
          currentLeaderboard.map(player => 
            player.id === payload.new.id ? payload.new : player
          )
        );
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(subscription);
    };
  }, []);

  async function fetchLeaderboard() {
    const { data, error } = await supabase
      .from('players')
      .select('id, username, wins, losses')
      .order('wins', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching leaderboard:', error);
    } else {
      setLeaderboard(data);
    }
  }

  return (
    <div>
      <Typography variant="h4">Leaderboard</Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Username</TableCell>
            <TableCell>Wins</TableCell>
            <TableCell>Losses</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {leaderboard.map((player, index) => (
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
}