import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

const fromSupabase = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

/*
### api_requests

| name            | type                     | format | required |
|-----------------|--------------------------|--------|----------|
| id              | integer                  | bigint | true     |
| created_at      | string                   | timestamp with time zone | true     |
| request_payload | string                   | text   | true     |
| user_id         | integer                  | bigint | true     |
| status          | string                   | text   | true     |
| updated_at      | string                   | timestamp with time zone | false    |

Foreign Key Relationships:
- user_id references users.id
*/

export const useApiRequest = (id) => useQuery({
  queryKey: ['api_requests', id],
  queryFn: () => fromSupabase(supabase.from('api_requests').select('*').eq('id', id).single()),
});

export const useApiRequests = () => useQuery({
  queryKey: ['api_requests'],
  queryFn: () => fromSupabase(supabase.from('api_requests').select('*')),
});

export const useAddApiRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newRequest) => fromSupabase(supabase.from('api_requests').insert([newRequest])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_requests'] });
    },
  });
};

export const useUpdateApiRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('api_requests').update(updateData).eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_requests'] });
    },
  });
};

export const useDeleteApiRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => fromSupabase(supabase.from('api_requests').delete().eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_requests'] });
    },
  });
};