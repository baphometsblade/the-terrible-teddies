import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useBattleState } from './useBattleState';
import { useBattleActions } from './useBattleActions';
import { getWeatherEffect } from '../utils/battleUtils';
import { applyBattleEvent } from '../utils/battleEvents';
import { getRandomTrait, applyTrait } from '../utils/teddyTraits';
import { getSpecialAbility } from '../utils/specialAbilities';

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
      const teddyWithTrait = applyTrait(data, getRandomTrait());
      return { ...teddyWithTrait, specialAbility: getSpecialAbility(teddyWithTrait.name) };
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
      const teddyWithTrait = applyTrait(data, getRandomTrait());
      return { ...teddyWithTrait, specialAbility: getSpecialAbility(teddyWithTrait.name) };
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

  const { performAction, handlePowerUp, handleCombo, handleSpecialAbility } = useBattleActions(
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
    if (playerTeddyData) {
      let updatedPlayerHealth = battleState.playerHealth;
      let updatedPlayerAttack = playerTeddyData.attack;
      let battleLog = [...battleState.battleLog];

      if (playerTeddyData.healthRecovery) {
        const healAmount = Math.floor(playerTeddyData.maxHealth * playerTeddyData.healthRecovery);
        updatedPlayerHealth = Math.min(updatedPlayerHealth + healAmount, playerTeddyData.maxHealth);
        battleLog.push(`${playerTeddyData.name} recovers ${healAmount} health due to Resilient trait!`);
      }

      if (playerTeddyData.berserk) {
        const healthLostPercentage = (playerTeddyData.maxHealth - updatedPlayerHealth) / playerTeddyData.maxHealth;
        const attackBoost = Math.floor(playerTeddyData.attack * (healthLostPercentage * 0.5));
        updatedPlayerAttack += attackBoost;
        battleLog.push(`${playerTeddyData.name}'s Berserker trait increases attack by ${attackBoost}!`);
      }

      updateBattleState(prevState => ({
        ...prevState,
        playerHealth: updatedPlayerHealth,
        playerAttack: updatedPlayerAttack,
        battleLog: battleLog,
      }));
    }

    if (opponentTeddyData) {
      // Apply similar logic for opponent teddy
    if (opponentTeddyData && opponentTeddyData.healthRecovery) {
      const healAmount = Math.floor(opponentTeddyData.maxHealth * opponentTeddyData.healthRecovery);
      updateBattleState(prevState => ({
        ...prevState,
        opponentHealth: Math.min(prevState.opponentHealth + healAmount, opponentTeddyData.maxHealth),
        battleLog: [...prevState.battleLog, `${opponentTeddyData.name} recovers ${healAmount} health due to Resilient trait!`]
      }));
    }
    }

    // Check for evolution
    if (battleState.playerExperience >= 100 && !battleState.playerIsEvolved) {
      updateBattleState(prevState => ({
        ...prevState,
        playerIsEvolved: true,
        playerAttack: Math.floor(prevState.playerAttack * 1.5),
        playerDefense: Math.floor(prevState.playerDefense * 1.5),
        battleLog: [...prevState.battleLog, `${playerTeddyData.name} has evolved and become stronger!`],
      }));
    }

    if (battleState.opponentExperience >= 100 && !battleState.opponentIsEvolved) {
      updateBattleState(prevState => ({
        ...prevState,
        opponentIsEvolved: true,
        opponentAttack: Math.floor(prevState.opponentAttack * 1.5),
        opponentDefense: Math.floor(prevState.opponentDefense * 1.5),
        battleLog: [...prevState.battleLog, `${opponentTeddyData.name} has evolved and become stronger!`],
      }));
    }

  }, [battleState.roundCount, updateBattleState, playerTeddyData, opponentTeddyData]);

  return {
    battleState,
    performAction,
    handlePowerUp,
    handleCombo,
    handleSpecialAbility,
    isLoading: isLoadingPlayer || isLoadingOpponent,
    error: playerError || opponentError,
  };
};
