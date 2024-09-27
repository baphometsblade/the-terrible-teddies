import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('id, username, score')
      .order('score', { ascending: false })
      .limit(10);

    if (data) setLeaderboard(data);
    if (error) console.error('Error fetching leaderboard:', error);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <ul>
        {leaderboard.map((player, index) => (
          <li key={player.id} className="mb-2">
            <span className="font-semibold">{index + 1}.</span> {player.username} - {player.score}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Leaderboard;