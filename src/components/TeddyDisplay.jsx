import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateRandomTeddy } from '../lib/supabase';

const TeddyDisplay = () => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const handleGenerateNewTeddy = async () => {
    const newTeddy = generateRandomTeddy();
    const { data, error } = await supabase
      .from('terrible_teddies')
      .insert([newTeddy]);
    if (error) console.error('Error inserting new teddy:', error);
    else console.log('New teddy inserted:', data);
  };

  if (isLoading) return <div>Loading teddies...</div>;
  if (error) return <div>Error loading teddies: {error.message}</div>;

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Terrible Teddies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teddies.map(teddy => (
          <div key={teddy.id} className="border p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold">{teddy.name}</h3>
            <p className="text-sm text-gray-600">{teddy.title}</p>
            <p className="mt-2">{teddy.description}</p>
            <div className="mt-2">
              <span className="font-bold">Attack:</span> {teddy.attack}
              <span className="font-bold ml-4">Defense:</span> {teddy.defense}
            </div>
            <p className="mt-2"><span className="font-bold">Special Move:</span> {teddy.special_move}</p>
          </div>
        ))}
      </div>
      <button 
        className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        onClick={handleGenerateNewTeddy}
      >
        Generate New Teddy
      </button>
    </div>
  );
};

export default TeddyDisplay;