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

/* supabase integration types

### a

| name       | type                       | format | required |
|------------|----------------------------|--------|----------|
| id         | int8                       | number | true     |
| created_at | timestamp with time zone   | string | true     |

*/

// Hooks for 'a' table
export const useA = () => useQuery({
    queryKey: ['a'],
    queryFn: () => fromSupabase(supabase.from('a').select('*'))
});

export const useAddA = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newA) => fromSupabase(supabase.from('a').insert([newA])),
        onSuccess: () => {
            queryClient.invalidateQueries('a');
        },
    });
};

export const useUpdateA = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('a').update(updateData).eq('id', id)),
        onSuccess: () => {
            queryClient.invalidateQueries('a');
        },
    });
};

export const useDeleteA = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id) => fromSupabase(supabase.from('a').delete().eq('id', id)),
        onSuccess: () => {
            queryClient.invalidateQueries('a');
        },
    });
};