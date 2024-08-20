import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const useTerribleTeddiesCards = () => {
  return useQuery({
    queryKey: ['terribleTeddiesCards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .select('*');
      if (error) throw error;
      return data;
    },
  });
};

export const useAddTerribleTeddiesCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (card) => {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .insert(card);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terribleTeddiesCards'] });
    },
  });
};

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

export const useUpdateUserStats = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stats) => {
      const { data, error } = await supabase
        .from('user_stats')
        .upsert(stats);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
  });
};

export const useUserStats = () => {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });
};