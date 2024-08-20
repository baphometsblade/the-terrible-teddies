import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase';
import { useCurrentUser } from '../integrations/supabase';

export const useUserCards = () => {
  const { data: currentUser } = useCurrentUser();

  return useQuery({
    queryKey: ['userCards', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', currentUser.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });
};