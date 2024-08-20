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