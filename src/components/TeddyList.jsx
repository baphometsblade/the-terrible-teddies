import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import TeddyCard from './TeddyCard';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';

const TeddyList = () => {
  const { session } = useSupabaseAuth();

  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['teddies'],
    queryFn: async () => {
      if (!session?.user) throw new Error('No authenticated user');
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user,
  });

  if (!session) return <div>Please sign in to view teddy bears.</div>;
  if (isLoading) return <div>Loading teddy bears...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!teddies || teddies.length === 0) {
    return <div>No teddy bears found. Please check your database.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teddies.map(teddy => (
        <TeddyCard key={teddy.id} teddy={teddy} />
      ))}
    </div>
  );
};

export default TeddyList;