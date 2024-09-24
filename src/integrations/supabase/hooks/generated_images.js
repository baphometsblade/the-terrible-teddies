import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

const fromSupabase = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

/*
### generated_images

| name        | type                     | format | required |
|-------------|--------------------------|--------|----------|
| id          | integer                  | bigint | true     |
| created_at  | string                   | timestamp with time zone | true     |
| energy_cost | integer                  | integer| false    |
| name        | string                   | text   | false    |
| type        | string                   | text   | false    |
| prompt      | string                   | text   | false    |
| url         | string                   | text   | false    |

No foreign key relationships identified.
*/

export const useGeneratedImage = (id) => useQuery({
  queryKey: ['generated_images', id],
  queryFn: () => fromSupabase(supabase.from('generated_images').select('*').eq('id', id).single()),
});

export const useGeneratedImages = () => useQuery({
  queryKey: ['generated_images'],
  queryFn: () => fromSupabase(supabase.from('generated_images').select('*')),
});

export const useAddGeneratedImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newImage) => fromSupabase(supabase.from('generated_images').insert([newImage])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated_images'] });
    },
  });
};

export const useUpdateGeneratedImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updateData }) => fromSupabase(supabase.from('generated_images').update(updateData).eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated_images'] });
    },
  });
};

export const useDeleteGeneratedImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => fromSupabase(supabase.from('generated_images').delete().eq('id', id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated_images'] });
    },
  });
};