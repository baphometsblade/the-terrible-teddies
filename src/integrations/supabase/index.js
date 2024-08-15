import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to handle Supabase responses
const fromSupabase = async (promise) => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

// Hook for fetching generated images
export const useGeneratedImages = () => {
  return useQuery({
    queryKey: ['generatedImages'],
    queryFn: async () => {
      try {
        console.log('Fetching generated images...');
        const { data, error } = await supabase.from('generated_images').select('*');
        if (error) {
          console.error('Supabase error:', error);
          throw new Error(`Supabase error: ${error.message}`);
        }
        console.log('Fetched data:', data);
        if (!data || data.length === 0) {
          console.warn('No images found in the database');
          throw new Error('No images found in the database');
        }
        return data;
      } catch (error) {
        console.error('Error in useGeneratedImages:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Query error in useGeneratedImages:', error);
    },
  });
};

// Hook for fetching user deck
export const useUserDeck = () => {
  return useQuery({
    queryKey: ['userDeck'],
    queryFn: () => fromSupabase(supabase.from('user_decks').select('*').single()),
  });
};

// Hook for updating user stats
export const useUpdateUserStats = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stats) => fromSupabase(supabase.from('user_stats').upsert(stats)),
    onSuccess: () => {
      queryClient.invalidateQueries('userStats');
    },
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

// Hook for evolving a card
export const useEvolveCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId) => fromSupabase(supabase.rpc('evolve_card', { card_id: cardId })),
    onSuccess: () => {
      queryClient.invalidateQueries('userDeck');
    },
  });
};

// Hook for adding a generated image
export const useAddGeneratedImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageData) => fromSupabase(supabase.from('generated_images').insert(imageData)),
    onSuccess: () => {
      queryClient.invalidateQueries('generatedImages');
    },
  });
};