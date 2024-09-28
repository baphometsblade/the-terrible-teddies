import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import TeddyCard from './TeddyCard';

const fetchPlayerCollection = async () => {
  const { data, error } = await supabase
    .from('player_collections')
    .select('*')
    .single();
  if (error) throw error;
  return data.collection;
};

const Collection = () => {
  const { data: collection, isLoading, error } = useQuery({
    queryKey: ['playerCollection'],
    queryFn: fetchPlayerCollection,
  });

  if (isLoading) return <div>Loading your collection...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4 text-center">Your Teddy Collection</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collection && collection.map(teddy => (
          <TeddyCard key={teddy.id} teddy={teddy} />
        ))}
      </div>
    </div>
  );
};

export default Collection;