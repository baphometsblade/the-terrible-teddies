import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

const fromSupabase = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

/*
### api_logs

| name        | type                     | format | required |
|-------------|--------------------------|--------|----------|
| id          | integer                  | bigint | true     |
| created_at  | string                   | timestamp with time zone | true     |
| log_message | string                   | text   | true     |
| log_level   | string                   | text   | true     |
| request_id  | integer                  | bigint | false    |

Foreign Key Relationships:
- request_id references api_requests.id
*/

export const useApiLog = (id) => useQuery({
  queryKey: ['api_logs', id],
  queryFn: () => fromSupabase(supabase.from('api_logs').select('*').eq('id', id).single()),
});

export const useApiLogs = () => useQuery({
  queryKey: ['api_logs'],
  queryFn: () => fromSupabase(supabase.from('api_logs').select('*')),
});

export const useAddApiLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newLog) => fromSupabase(supabase.from('api_logs').insert([newLog])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_logs'] });
    },
  });
};

export const useUpdateApiLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('api_logs').update(updateData).eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_logs'] });
    },
  });
};

export const useDeleteApiLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => fromSupabase(supabase.from('api_logs').delete().eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_logs'] });
    },
  });
};