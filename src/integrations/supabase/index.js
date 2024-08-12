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

/* supabase integration types

### generated_images

| name        | type                     | format | required |
|-------------|--------------------------|--------|----------|
| id          | int8                     | number | true     |
| created_at  | timestamp with time zone | string | true     |
| name        | text                     | string | true     |
| url         | text                     | string | true     |
| prompt      | text                     | string | true     |
| type        | text                     | string | true     |
| energy_cost | int4                     | number | true     |

*/

// Hooks for generated_images table

export const useGeneratedImages = () => useQuery({
    queryKey: ['generated_images'],
    queryFn: () => fromSupabase(supabase.from('generated_images').select('*')),
});

export const useGeneratedImage = (id) => useQuery({
    queryKey: ['generated_images', id],
    queryFn: () => fromSupabase(supabase.from('generated_images').select('*').eq('id', id).single()),
});

export const useAddGeneratedImage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newImage) => fromSupabase(supabase.from('generated_images').insert([newImage])),
        onSuccess: () => {
            queryClient.invalidateQueries('generated_images');
        },
    });
};

export const useUpdateGeneratedImage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('generated_images').update(updateData).eq('id', id)),
        onSuccess: () => {
            queryClient.invalidateQueries('generated_images');
        },
    });
};

export const useDeleteGeneratedImage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id) => fromSupabase(supabase.from('generated_images').delete().eq('id', id)),
        onSuccess: () => {
            queryClient.invalidateQueries('generated_images');
        },
    });
};