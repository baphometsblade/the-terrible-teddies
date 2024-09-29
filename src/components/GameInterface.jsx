import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const GameInterface = ({ session }) => {
  const [playerTeddies, setPlayerTeddies] = useState([]);

  useEffect(() => {
    fetchPlayerTeddies();
  }, []);

  const fetchPlayerTeddies = async () => {
    const { data, error } = await supabase
      .from('player_teddies')
      .select(`
        id,
        terrible_teddies (*)
      `)
      .eq('player_id', session.user.id);

    if (error) {
      console.error('Error fetching player teddies:', error);
    } else {
      setPlayerTeddies(data.map(item => item.terrible_teddies));
    }
  };

  return (
    <div>
      <h1>Welcome to Terrible Teddies!</h1>
      <h2>Your Teddies:</h2>
      {playerTeddies.map(teddy => (
        <div key={teddy.id}>
          <h3>{teddy.name}</h3>
          <p>{teddy.description}</p>
          <p>Attack: {teddy.attack}</p>
          <p>Defense: {teddy.defense}</p>
        </div>
      ))}
    </div>
  );
};

export default GameInterface;