import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

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

export const useUserCards = () => {
  const { data: currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ['userCards', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });
};

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

export const useUserStats = () => {
  const { data: currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ['userStats', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });
};

export const useUpdateUserStats = () => {
  const { data: currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (newStats) => {
      if (!currentUser) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('user_stats')
        .update(newStats)
        .eq('user_id', currentUser.id);
      if (error) throw error;
      return data;
    },
  });
};

export const useAddGeneratedImage = () => {
  return useMutation({
    mutationFn: async (newImage) => {
      const { data, error } = await supabase
        .from('generated_images')
        .insert(newImage);
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

export const useEvolveCard = () => {
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
  });
};

export const useUserDeck = () => {
  const { data: currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ['userDeck', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from('user_decks')
        .select('cards')
        .eq('user_id', currentUser.id)
        .single();
      if (error) throw error;
      return data?.cards || [];
    },
    enabled: !!currentUser,
  });
};