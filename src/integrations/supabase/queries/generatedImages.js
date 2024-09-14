import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../index';

export const useGeneratedImages = () => {
  return useQuery({
    queryKey: ['generatedImages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_images')
        .select('*');
      if (error) throw error;
      return data;
    },
  });
};

export const useAddGeneratedImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newImage) => {
      const { data, error } = await supabase
        .from('generated_images')
        .insert(newImage);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['generatedImages']);
    },
  });
};