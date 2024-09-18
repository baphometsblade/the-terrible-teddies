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

// ... (keep existing hooks)

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

// Hook for adding a card image
export const useAddCardImage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (imageData) => fromSupabase(supabase.from('card_images').insert(imageData)),
        onSuccess: () => {
            queryClient.invalidateQueries('cardImages');
        },
    });
};