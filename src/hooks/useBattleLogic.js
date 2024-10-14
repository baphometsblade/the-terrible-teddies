import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useBattleState } from './useBattleState';
import { useBattleActions } from './useBattleActions';
import { getWeatherEffect } from '../utils/battleUtils';

export const useBattleLogic = (playerTeddy, opponentTeddy) => {
  const [battleState, updateBattleState] = useBattleState();

  const { data: playerTeddyData, isLoading: isLoadingPlayer, error: playerError } = useQuery({
    queryKey: ['teddy', playerTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', playerTeddy.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponent, error: opponentError } = useQuery({
    queryKey: ['teddy', opponentTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', opponentTeddy.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updatePlayerTeddyMutation = useMutation({
    mutationFn: async (updatedTeddy) => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .update(updatedTeddy)
        .eq('id', playerTeddy.id);
      if (error) throw error;
      return data;
    },
  });

  const { performAction, handlePowerUp, handleCombo } = useBattleActions(
    battleState,
    updateBattleState,
    playerTeddyData,
    opponentTeddyData,
    updatePlayerTeddyMutation
  );

  useEffect(() => {
    if (battleState.roundCount % 5 === 0) {
      const newWeather = getWeatherEffect();
      updateBattleState({ weatherEffect: newWeather });
    }
  }, [battleState.roundCount, updateBattleState]);

  return {
    battleState,
    performAction,
    handlePowerUp,
    handleCombo,
    isLoading: isLoadingPlayer || isLoadingOpponent,
    error: playerError || opponentError,
  };
};