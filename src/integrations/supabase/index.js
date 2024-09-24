import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

import React from "react";
export const queryClient = new QueryClient();
export function SupabaseProvider({ children }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

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
        staleTime: 1000 * 60 * 5, // 5 minutes
        cacheTime: 1000 * 60 * 30, // 30 minutes
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
            queryClient.invalidateQueries('generatedImages');
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
