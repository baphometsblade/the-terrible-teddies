import { useQuery } from '@tanstack/react-query';
import { supabase } from '../index';

export const useTerribleTeddiesCards = () => {
  return useQuery({
    queryKey: ['terribleTeddiesCards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_images')
        .select('*');
      if (error) throw error;
      console.log('Fetched cards:', data);
      return data;
    },
  });
};