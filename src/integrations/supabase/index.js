import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

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
    mutationFn: async (imageData) => {
      const { data, error } = await supabase
        .from('generated_images')
        .insert(imageData);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('generatedImages');
    },
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

export const useAddTerribleTeddiesCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (card) => {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .insert(card);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('terribleTeddiesCards');
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

export const useUpdateUserStats = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stats) => {
      const { data, error } = await supabase
        .from('user_stats')
        .upsert(stats);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('userStats');
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
      return data;
    },
  });
};

export const useLeaderboard = () => {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('username, games_won, games_played')
        .order('games_won', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
};

export const useDailyChallenge = () => {
  return useQuery({
    queryKey: ['dailyChallenge'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('date', today)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });
};

export const useAddDailyChallenge = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challenge) => {
      const { data, error } = await supabase
        .from('daily_challenges')
        .insert(challenge);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries('dailyChallenge');
    },
  });
};