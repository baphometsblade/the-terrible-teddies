import React from 'react';
import { useQuery } from '@tanstack/react-query';
import TeddyCard from './TeddyCard';
import { supabase } from '../lib/supabase';

const Collection = () => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading your collection...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teddies.map(teddy => (
        <TeddyCard key={teddy.id} teddy={teddy} />
      ))}
    </div>
  );
};

export default Collection;