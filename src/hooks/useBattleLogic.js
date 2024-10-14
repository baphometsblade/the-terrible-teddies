import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useBattleState } from './useBattleState';
import { useBattleActions } from './useBattleActions';
import { getSpecialAbility } from '../utils/specialAbilities';
import { applyBattleEvent } from '../utils/battleEvents';
import { getWeatherEffect } from '../utils/weatherEffects';
import { applyWeatherEffect, applyStatusEffects } from '../utils/battleEffects';

export const useBattleLogic = (playerTeddy, opponentTeddy) => {
  const [battleState, updateBattleState] = useBattleState();
  
  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy', playerTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', playerTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy', opponentTeddy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', opponentTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
  });

  const updateBattleMutation = useMutation({
    mutationFn: async (newBattleState) => {
      const { data, error } = await supabase
        .from('battles')
        .update(newBattleState)
        .eq('id', battleState.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Refetch battle data after successful update
      queryClient.invalidateQueries(['battle', battleState.id]);
    },
  });

  const { performAction, handlePowerUp, handleCombo } = useBattleActions(
    battleState,
    updateBattleState,
    playerTeddyData,
    opponentTeddyData,
    updateBattleMutation
  );

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      updateBattleState({
        battleLog: [...battleState.battleLog, `Battle ended! ${winner} wins!`],
      });
      // Here you would typically update the database, award XP, etc.
    }
  }, [battleState.playerHealth, battleState.opponentHealth, playerTeddyData, opponentTeddyData]);

  useEffect(() => {
    // Apply battle events
    if (battleState.roundCount % 3 === 0) {
      const updatedState = applyBattleEvent(battleState);
      updateBattleState(updatedState);
    }

    // Update weather
    if (battleState.roundCount % 5 === 0) {
      const newWeatherEffect = getWeatherEffect();
      updateBattleState({
        weatherEffect: newWeatherEffect,
        battleLog: [...battleState.battleLog, `The weather has changed to ${newWeatherEffect.name}!`],
      });
    }

    // Apply weather effects
    if (battleState.weatherEffect) {
      const weatherUpdatedState = applyWeatherEffect(battleState, playerTeddyData, opponentTeddyData);
      updateBattleState(weatherUpdatedState);
    }

    // Apply status effects
    const statusUpdatedState = applyStatusEffects(battleState, playerTeddyData, opponentTeddyData);
    updateBattleState(statusUpdatedState);
  }, [battleState.roundCount, battleState.weatherEffect]);

  return {
    battleState,
    handleAction: performAction,
    handlePowerUp,
    handleCombo,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData
  };
};