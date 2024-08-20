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
      queryClient.invalidateQueries({ queryKey: ['terribleTeddiesCards'] });
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
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (updates) => {
      if (!currentUser) throw new Error('No user logged in');
      const { data, error } = await supabase
        .from('user_stats')
        .update(updates)
        .eq('user_id', currentUser.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userStats', currentUser?.id] });
    },
  });
};

export const useUserDeck = () => {
  const { data: currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ['userDeck', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      const { data, error } = await supabase
        .from('user_decks')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });
};

export const useUpdateUserDeck = () => {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (deck) => {
      if (!currentUser) throw new Error('No user logged in');
      const { data, error } = await supabase
        .from('user_decks')
        .upsert({ user_id: currentUser.id, deck })
        .eq('user_id', currentUser.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDeck', currentUser?.id] });
    },
  });
};