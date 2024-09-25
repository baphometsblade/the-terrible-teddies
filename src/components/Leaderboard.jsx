import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('username, wins')
      .order('wins', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching leaderboard:', error);
    } else {
      setLeaderboard(data);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <ul>
        {leaderboard.map((player, index) => (
          <li key={index} className="mb-2">
            {index + 1}. {player.username} - Wins: {player.wins}
          </li>
        ))}
      </ul>
    </div>
  );
};
