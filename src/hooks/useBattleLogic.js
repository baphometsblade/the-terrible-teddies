import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getSpecialAbility } from '../utils/specialAbilities';
import { applyBattleEffect } from '../utils/battleEffects';
import { getRandomWeatherEffect, applyWeatherEffect } from '../utils/weatherEffects';
import { getAIAction } from '../utils/AIOpponent';
import { useBattleState } from './useBattleState';
import { performPlayerAction, performAIAction } from '../utils/battleActions';
import { drawCardFromDeck, shuffleDeck } from '../utils/deckUtils';
import { useCardActions } from './useCardActions';
import { useBattleEffects } from './useBattleEffects';

export const useBattleLogic = () => {
  const [battleState, updateBattleState] = useBattleState();
  const [randomEvents, setRandomEvents] = useState([]);
  const [weatherEffect, setWeatherEffect] = useState(getRandomWeatherEffect());

  const { drawCard, playCard, endTurn } = useCardActions(battleState, updateBattleState);
  const { applyEffects } = useBattleEffects(battleState, updateBattleState, weatherEffect, setWeatherEffect);

  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy', battleState.playerTeddyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', battleState.playerTeddyId)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!battleState.playerTeddyId,
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy', battleState.opponentTeddyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', battleState.opponentTeddyId)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!battleState.opponentTeddyId,
  });

  useEffect(() => {
    applyEffects();
  }, [battleState.roundCount]);

  const handleAction = async (action) => {
    const newState = performPlayerAction(action, battleState, playerTeddyData, opponentTeddyData);
    updateBattleState(newState);
    return newState;
  };

  const handlePowerUp = () => {
    if (battleState.powerUpMeter === 100) {
      updateBattleState({
        ...battleState,
        playerEnergy: battleState.playerEnergy + 2,
        powerUpMeter: 0,
        battleLog: [...battleState.battleLog, `${playerTeddyData.name} uses Power Up and gains 2 energy!`],
      });
    }
  };

  const handleCombo = () => {
    if (battleState.comboMeter === 100) {
      const comboDamage = playerTeddyData.attack * 2;
      updateBattleState({
        ...battleState,
        opponentHealth: Math.max(0, battleState.opponentHealth - comboDamage),
        comboMeter: 0,
        battleLog: [...battleState.battleLog, `${playerTeddyData.name} unleashes a devastating combo attack for ${comboDamage} damage!`],
      });
    }
  };

  const aiAction = async () => {
    const action = getAIAction(opponentTeddyData, playerTeddyData, battleState);
    const newState = performAIAction(action, battleState, opponentTeddyData, playerTeddyData);
    updateBattleState(newState);
    return { action, newState };
  };

  return {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    drawCard,
    playCard,
    endTurn,
    aiAction,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
    randomEvents,
    weatherEffect,
  };
};