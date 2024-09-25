import React, { useState, useEffect } from 'react';
import { fetchTeddyBears } from '../utils/supabaseClient';

const Game = () => {
  const [teddyBears, setTeddyBears] = useState([]);

  useEffect(() => {
    const loadTeddyBears = async () => {
      const bears = await fetchTeddyBears();
      setTeddyBears(bears);
    };
    loadTeddyBears();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Terrible Teddies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teddyBears.map((bear) => (
          <div key={bear.id} className="bg-white shadow-md rounded-lg p-4">
            <h3 className="text-xl font-semibold">{bear.name}</h3>
            <p className="text-sm text-gray-600">{bear.title}</p>
            <p className="mt-2">Attack: {bear.attack}</p>
            <p>Defense: {bear.defense}</p>
            <p className="mt-2 font-semibold">Special Move: {bear.special_move}</p>
            <p className="text-sm">{bear.special_move_description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Game;
