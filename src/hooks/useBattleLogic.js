import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { checkForCombo, applyCombo } from '../utils/comboSystem';
import { useSpecialAbility } from '../utils/specialAbilities';
import { applyWeatherEffect, getRandomWeather } from '../utils/weatherEffects';
import { getAIAction } from '../utils/AIOpponent';
import { useBattleState } from './useBattleState';
import { performPlayerAction, performAIAction } from '../utils/battleActions';
import { useCardActions } from './useCardActions';
import { useBattleEffects } from './useBattleEffects';

export const useBattleLogic = () => {
  const [battleState, updateBattleState] = useBattleState();
  const [randomEvents, setRandomEvents] = useState([]);
  const [weatherEffect, setWeatherEffect] = useState(getRandomWeather());
  const [moveHistory, setMoveHistory] = useState([]);

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
    let newState = performPlayerAction(action, battleState, playerTeddyData, opponentTeddyData);
    
    // Apply weather effects
    if (action === 'attack') {
      newState.opponentHealth = applyWeatherEffect('attack', newState.opponentHealth, weatherEffect);
    }

    // Check for combo
    setMoveHistory([...moveHistory, action]);
    const combo = checkForCombo(moveHistory);
    if (combo) {
      const comboDamage = applyCombo(newState.lastDamageDealt, combo);
      newState.opponentHealth -= comboDamage;
      newState.battleLog.push(`${playerTeddyData.name} performed a ${combo.name} for ${comboDamage} damage!`);
    }

    updateBattleState(newState);
    return newState;
  };

  const handleSpecialAbility = () => {
    const { damage, healing, effect } = useSpecialAbility(playerTeddyData.specialAbility, playerTeddyData, opponentTeddyData);
    let newState = { ...battleState };

    if (damage) {
      newState.opponentHealth -= damage;
      newState.battleLog.push(`${playerTeddyData.name} used ${playerTeddyData.specialAbility} for ${damage} damage!`);
    }

    if (healing) {
      newState.playerHealth = Math.min(100, newState.playerHealth + healing);
      newState.battleLog.push(`${playerTeddyData.name} healed for ${healing} HP!`);
    }

    if (effect) {
      newState.battleLog.push(`Effect: ${effect}`);
    }

    updateBattleState(newState);
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
    let newState = performAIAction(action, battleState, opponentTeddyData, playerTeddyData);

    // Apply weather effects for AI actions
    if (action === 'attack') {
      newState.playerHealth = applyWeatherEffect('attack', newState.playerHealth, weatherEffect);
    }

    updateBattleState(newState);
    return { action, newState };
  };

  return {
    battleState,
    handleAction,
    handleSpecialAbility,
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
