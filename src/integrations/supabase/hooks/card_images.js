import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

const fromSupabase = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

/*
### card_images

| name       | type                     | format | required |
|------------|--------------------------|--------|----------|
| id         | integer                  | bigint | true     |
| created_at | string                   | timestamp with time zone | true     |

No foreign key relationships identified.
*/

export const useCardImage = (id) => useQuery({
  queryKey: ['card_images', id],
  queryFn: () => fromSupabase(supabase.from('card_images').select('*').eq('id', id).single()),
});

export const useCardImages = () => useQuery({
  queryKey: ['card_images'],
  queryFn: () => fromSupabase(supabase.from('card_images').select('*')),
});

export const useAddCardImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newImage) => fromSupabase(supabase.from('card_images').insert([newImage])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card_images'] });
    },
  });
};

export const useUpdateCardImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('card_images').update(updateData).eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card_images'] });
    },
  });
};

export const useDeleteCardImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => fromSupabase(supabase.from('card_images').delete().eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card_images'] });
    },
  });
};