import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Leaderboard = () => {
  // This would typically come from a database or API
  const topPlayers = [
    { id: 1, name: 'TeddyMaster123', wins: 50, losses: 10 },
    { id: 2, name: 'BearBattler456', wins: 45, losses: 15 },
    { id: 3, name: 'FuzzyFighter789', wins: 40, losses: 20 },
    { id: 4, name: 'CuddleCrusher101', wins: 35, losses: 25 },
    { id: 5, name: 'PlushPummeler202', wins: 30, losses: 30 },
  ];

  return (
    <div className="leaderboard">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Wins</TableHead>
            <TableHead>Losses</TableHead>
            <TableHead>Win Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topPlayers.map((player, index) => (
            <TableRow key={player.id}>
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell>{player.name}</TableCell>
              <TableCell>{player.wins}</TableCell>
              <TableCell>{player.losses}</TableCell>
              <TableCell>{((player.wins / (player.wins + player.losses)) * 100).toFixed(2)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Leaderboard;