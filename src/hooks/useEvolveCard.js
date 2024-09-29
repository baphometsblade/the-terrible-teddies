import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const useEvolveCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId) => {
      const { data, error } = await supabase
        .from('player_teddies')
        .update({ level: supabase.raw('level + 1') })
        .eq('id', cardId)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('playerTeddies');
    },
  });
};