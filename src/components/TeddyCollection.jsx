import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';

const TeddyCollection = () => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('player_teddies')
        .select('terrible_teddies(*)')
        .eq('player_id', user.id);
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
  });

  if (isLoading) return <div>Loading your teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teddies.map(teddy => (
        <TeddyCard key={teddy.id} teddy={teddy} />
      ))}
    </div>
  );
};

export default TeddyCollection;