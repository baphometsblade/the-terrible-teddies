import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

const fromSupabase = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

/*
### api_responses

| name             | type                     | format | required |
|------------------|--------------------------|--------|----------|
| id               | integer                  | bigint | true     |
| created_at       | string                   | timestamp with time zone | true     |
| response_payload | string                   | text   | true     |
| request_id       | integer                  | bigint | true     |
| status_code      | integer                  | integer| true     |
| updated_at       | string                   | timestamp with time zone | false    |

Foreign Key Relationships:
- request_id references api_requests.id
*/

export const useApiResponse = (id) => useQuery({
  queryKey: ['api_responses', id],
  queryFn: () => fromSupabase(supabase.from('api_responses').select('*').eq('id', id).single()),
});

export const useApiResponses = () => useQuery({
  queryKey: ['api_responses'],
  queryFn: () => fromSupabase(supabase.from('api_responses').select('*')),
});

export const useAddApiResponse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newResponse) => fromSupabase(supabase.from('api_responses').insert([newResponse])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_responses'] });
    },
  });
};

export const useUpdateApiResponse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('api_responses').update(updateData).eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_responses'] });
    },
  });
};

export const useDeleteApiResponse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => fromSupabase(supabase.from('api_responses').delete().eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_responses'] });
    },
  });
};