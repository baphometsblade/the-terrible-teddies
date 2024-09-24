import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

const fromSupabase = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

/*
### api_keys

| name       | type                     | format | required |
|------------|--------------------------|--------|----------|
| id         | integer                  | bigint | true     |
| created_at | string                   | timestamp with time zone | true     |
| user_id    | integer                  | bigint | true     |
| api_key    | string                   | text   | true     |
| is_active  | boolean                  | boolean| true     |

Foreign Key Relationships:
- user_id references users.id
*/

export const useApiKey = (id) => useQuery({
  queryKey: ['api_keys', id],
  queryFn: () => fromSupabase(supabase.from('api_keys').select('*').eq('id', id).single()),
});

export const useApiKeys = () => useQuery({
  queryKey: ['api_keys'],
  queryFn: () => fromSupabase(supabase.from('api_keys').select('*')),
});

export const useAddApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newApiKey) => fromSupabase(supabase.from('api_keys').insert([newApiKey])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_keys'] });
    },
  });
};

export const useUpdateApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('api_keys').update(updateData).eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_keys'] });
    },
  });
};

export const useDeleteApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => fromSupabase(supabase.from('api_keys').delete().eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_keys'] });
    },
  });
};