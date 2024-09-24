import { supabase } from '../../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fromSupabase = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

// Hook for fetching generated images
export const useGeneratedImages = () => {
  return useQuery({
    queryKey: ['generatedImages'],
    queryFn: () => fromSupabase(supabase.from('generated_images').select('*')),
  });
};

// Hook for fetching user deck
export const useUserDeck = () => {
  return useQuery({
    queryKey: ['userDeck'],
    queryFn: () => fromSupabase(supabase.from('user_decks').select('*').single()),
  });
};

// Hook for saving user deck
export const useSaveUserDeck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deck) => fromSupabase(supabase.from('user_decks').upsert({ deck })),
    onSuccess: () => {
      queryClient.invalidateQueries('userDeck');
    },
  });
};

// Hook for fetching shop cards
export const useShopCards = () => {
  return useQuery({
    queryKey: ['shopCards'],
    queryFn: () => fromSupabase(supabase.from('shop_cards').select('*')),
  });
};

// Hook for evolving a card
export const useEvolveCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cardId) => {
      const { data, error } = await supabase
        .from('generated_images')
        .update({ level: supabase.raw('level + 1') })
        .eq('id', cardId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('generatedImages');
      queryClient.invalidateQueries('userDeck');
    },
  });
};
