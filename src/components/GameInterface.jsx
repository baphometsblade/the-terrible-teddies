import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import TeddyCard from './TeddyCard';

const GameInterface = () => {
  const [playerTeddies, setPlayerTeddies] = useState([]);
  const [selectedTeddy, setSelectedTeddy] = useState(null);

  useEffect(() => {
    fetchPlayerTeddies();
  }, []);

  const fetchPlayerTeddies = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', user.id);

      if (error) {
        console.error('Error fetching player teddies:', error);
      } else {
        setPlayerTeddies(data.map(pt => pt.terrible_teddies));
      }
    }
  };

  const handleTeddySelect = (teddy) => {
    setSelectedTeddy(teddy);
  };

  const handleBattleStart = () => {
    if (selectedTeddy) {
      console.log('Starting battle with:', selectedTeddy);
      // Implement battle logic here
    } else {
      console.log('Please select a teddy first');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Terrible Teddies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {playerTeddies.map(teddy => (
          <TeddyCard
            key={teddy.id}
            teddy={teddy}
            onSelect={() => handleTeddySelect(teddy)}
            isSelected={selectedTeddy && selectedTeddy.id === teddy.id}
          />
        ))}
      </div>
      <Button onClick={handleBattleStart} disabled={!selectedTeddy}>
        Start Battle
      </Button>
    </div>
  );
};

export default GameInterface;