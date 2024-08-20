import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const useTerribleTeddiesCards = () => {
  return useQuery({
    queryKey: ['terribleTeddiesCards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .select('*');
      if (error) throw error;
      return data;
    },
  });
};

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

export const useUserDeck = () => {
  return useQuery({
    queryKey: ['userDeck'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_decks')
        .select('*')
        .single();
      if (error) throw error;
      return data?.cards || [];
    },
  });
};

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

export const useEvolveCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cardId) => {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .update({ level: supabase.raw('level + 1') })
        .eq('id', cardId)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['terribleTeddiesCards']);
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['currentUser']);
    },
  });
};