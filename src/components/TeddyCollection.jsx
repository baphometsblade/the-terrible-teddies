import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';

const TeddyCollection = () => {
  const { data: collection, isLoading, error } = useQuery({
    queryKey: ['teddyCollection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Loading your teddy collection...</div>;
  if (error) return <div>Error loading collection: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Your Teddy Collection</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collection.map(teddy => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};

export default TeddyCollection;