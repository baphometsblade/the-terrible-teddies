import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import { Skeleton } from "@/components/ui/skeleton";
import { useSupabaseAuth } from '../integrations/supabase/auth';

const TeddyCollection = () => {
  const { session } = useSupabaseAuth();

  const { data: teddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', session.user.id);
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
    enabled: !!session?.user?.id,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, index) => (
          <Skeleton key={index} className="h-[200px] w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>;
  }

  if (!teddies || teddies.length === 0) {
    return <div className="text-center">No teddies found. Start collecting!</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teddies.map(teddy => (
        <TeddyCard key={teddy.id} teddy={teddy} />
      ))}
    </div>
  );
};

export default TeddyCollection;