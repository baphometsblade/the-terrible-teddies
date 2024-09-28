import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('player_stats')
      .select('username, wins, losses')
      .order('wins', { ascending: false })
      .limit(10);

    if (error) console.error('Error fetching leaderboard:', error);
    else setLeaderboard(data);
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">Rank</th>
            <th className="p-2 text-left">Username</th>
            <th className="p-2 text-left">Wins</th>
            <th className="p-2 text-left">Losses</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
              <td className="p-2">{index + 1}</td>
              <td className="p-2">{player.username}</td>
              <td className="p-2">{player.wins}</td>
              <td className="p-2">{player.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;