import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../index';

export const useEvolveCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cardId) => {
      const { data: currentCard, error: fetchError } = await supabase
        .from('terrible_teddies_cards')
        .select('*')
        .eq('id', cardId)
        .single();

      if (fetchError) throw fetchError;

      const newLevel = currentCard.level + 1;
      const newAttack = Math.floor(currentCard.attack * 1.2);
      const newDefense = Math.floor(currentCard.defense * 1.2);

      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .update({ 
          level: newLevel, 
          attack: newAttack, 
          defense: newDefense,
          name: `${currentCard.name} Lv.${newLevel}`
        })
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