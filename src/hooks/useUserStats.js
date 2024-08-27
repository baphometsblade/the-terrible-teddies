import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase';

export const useUserStats = () => {
  const [userStats, setUserStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const { data, error } = await supabase
          .from('user_stats')
          .select('*')
          .single();

        if (error) throw error;

        setUserStats(data);
      } catch (error) {
        console.error('Error fetching user stats:', error);
        // Set default stats if there's an error
        setUserStats({ coins: 0, games_won: 0 });
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchUserStats();
  }, []);

  return { userStats, isLoadingStats };
};