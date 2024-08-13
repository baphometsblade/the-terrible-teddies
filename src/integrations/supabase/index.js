// ... (existing imports and code)

// Hook for evolving a card
export const useEvolveCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId) => fromSupabase(supabase.rpc('evolve_card', { card_id: cardId })),
    onSuccess: () => {
      queryClient.invalidateQueries('userDeck');
    },
  });
};

// ... (existing exports)
// Remove the duplicate export of useEvolveCard