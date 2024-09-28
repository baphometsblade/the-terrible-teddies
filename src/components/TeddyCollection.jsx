import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Spinner } from "@/components/ui/spinner";

const fetchTeddies = async () => {
  const { data, error } = await supabase
    .from('player_teddies')
    .select('*');
  if (error) throw error;
  return data;
};

const TeddyCollection = () => {
  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: fetchTeddies,
  });

  if (isLoading) return <Spinner />;
  if (error) return <div>Error loading collection: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Your Teddy Collection</h2>
      {teddies && teddies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teddies.map(teddy => (
            <TeddyCard key={teddy.id} teddy={teddy} />
          ))}
        </div>
      ) : (
        <p>You don't have any teddies yet. Visit the shop to get some!</p>
      )}
    </div>
  );
};

export default TeddyCollection;