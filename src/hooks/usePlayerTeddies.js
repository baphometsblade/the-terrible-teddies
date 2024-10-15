import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const usePlayerTeddies = () => {
  return useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(pt => ({...pt.terrible_teddies, player_teddy_id: pt.id}));
    },
  });
};