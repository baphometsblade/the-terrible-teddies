import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useBattleState } from './useBattleState';
import { useBattleActions } from './useBattleActions';
import { getWeatherEffect } from '../utils/battleUtils';
import { applyBattleEvent } from '../utils/battleEvents';
import { getRandomTrait, applyTrait } from '../utils/teddyTraits';

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
      return applyTrait(data, getRandomTrait());
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
      return applyTrait(data, getRandomTrait());
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

    if (battleState.roundCount % 3 === 0) {
      const updatedState = applyBattleEvent(battleState);
      updateBattleState(updatedState);
    }

    // Apply trait effects at the end of each round
    if (playerTeddyData && playerTeddyData.healthRecovery) {
      const healAmount = Math.floor(playerTeddyData.maxHealth * playerTeddyData.healthRecovery);
      updateBattleState(prevState => ({
        ...prevState,
        playerHealth: Math.min(prevState.playerHealth + healAmount, playerTeddyData.maxHealth),
        battleLog: [...prevState.battleLog, `${playerTeddyData.name} recovers ${healAmount} health due to Resilient trait!`]
      }));
    }

    if (opponentTeddyData && opponentTeddyData.healthRecovery) {
      const healAmount = Math.floor(opponentTeddyData.maxHealth * opponentTeddyData.healthRecovery);
      updateBattleState(prevState => ({
        ...prevState,
        opponentHealth: Math.min(prevState.opponentHealth + healAmount, opponentTeddyData.maxHealth),
        battleLog: [...prevState.battleLog, `${opponentTeddyData.name} recovers ${healAmount} health due to Resilient trait!`]
      }));
    }
  }, [battleState.roundCount, updateBattleState, playerTeddyData, opponentTeddyData]);

  return {
    battleState,
    performAction,
    handlePowerUp,
    handleCombo,
    isLoading: isLoadingPlayer || isLoadingOpponent,
    error: playerError || opponentError,
  };
};