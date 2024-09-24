import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SupabaseProvider } from './auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

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

export { SupabaseProvider };
