import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const usePlayerTeddies = () => {
  return useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(pt => pt.terrible_teddies);
    },
  });
};