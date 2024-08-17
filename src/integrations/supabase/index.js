import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY;

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
      queryClient.invalidateQueries('terribleTeddiesCards');
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
      queryClient.invalidateQueries('userStats');
    },
  });
};