import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from "react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

export const queryClient = new QueryClient();
export function SupabaseProvider({ children }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const fromSupabase = async (query) => {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
};

// ... (keep existing code)

// Add these new hooks
export const useUserDeck = () => useQuery({
    queryKey: ['userDeck'],
    queryFn: () => fromSupabase(supabase.from('user_decks').select('*').single()),
});

export const useSaveUserDeck = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (deck) => fromSupabase(supabase.from('user_decks').upsert({ deck }, { onConflict: 'user_id' })),
        onSuccess: () => {
            queryClient.invalidateQueries('userDeck');
        },
    });
};

export const useUpdateUserStats = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (stats) => fromSupabase(supabase.from('user_stats').upsert(stats, { onConflict: 'user_id' })),
        onSuccess: () => {
            queryClient.invalidateQueries('userStats');
        },
    });
};

// ... (keep any other existing exports)