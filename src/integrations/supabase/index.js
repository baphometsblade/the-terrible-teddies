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

// Hook for adding a generated image
export const useAddGeneratedImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageData) => fromSupabase(supabase.from('generated_images').insert(imageData)),
    onSuccess: () => {
      queryClient.invalidateQueries('generatedImages');
    },
  });
};

// ... (existing exports)
// Remove the duplicate exports