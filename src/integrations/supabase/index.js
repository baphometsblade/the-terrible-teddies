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
        queryFn: () => fromSupabase(supabase.from('user_decks').select('*')),
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

export { SupabaseProvider };