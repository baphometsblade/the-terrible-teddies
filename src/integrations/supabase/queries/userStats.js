import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../index';

export const useUpdateUserStats = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newStats) => {
      const { data, error } = await supabase
        .from('user_stats')
        .update(newStats)
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userStats']);
    },
  });
};

export const useUserStats = () => {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });
};