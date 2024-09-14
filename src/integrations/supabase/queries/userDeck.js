import { useQuery } from '@tanstack/react-query';
import { supabase } from '../index';

export const useUserDeck = () => {
  return useQuery({
    queryKey: ['userDeck'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_decks')
        .select('*')
        .single();
      if (error) throw error;
      return data?.cards || [];
    },
  });
};