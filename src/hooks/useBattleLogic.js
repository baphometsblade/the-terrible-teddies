import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getSpecialAbility } from '../utils/specialAbilities';
import { applyBattleEffect } from '../utils/battleEffects';
import { getRandomWeatherEffect, applyWeatherEffect } from '../utils/weatherEffects';
import { getAIAction } from '../utils/AIOpponent';
import { useBattleState } from './useBattleState';
import { performPlayerAction, performAIAction } from '../utils/battleActions';

export const useBattleLogic = () => {
  const [battleState, updateBattleState] = useBattleState();
  const [randomEvents, setRandomEvents] = useState([]);
  const [weatherEffect, setWeatherEffect] = useState(getRandomWeatherEffect());

  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy', playerTeddy?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', playerTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!playerTeddy,
  });

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy', opponentTeddy?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', opponentTeddy.id)
        .single();
      if (error) throw error;
      return { ...data, specialAbility: getSpecialAbility(data.name) };
    },
    enabled: !!opponentTeddy,
  });

  useEffect(() => {
    const applyEffects = () => {
      if (battleState.roundCount % 3 === 0) {
        const updatedState = applyBattleEffect(battleState);
        updateBattleState(updatedState);
      }

      if (battleState.roundCount % 5 === 0) {
        const newWeatherEffect = getRandomWeatherEffect();
        setWeatherEffect(newWeatherEffect);
        updateBattleState((prevState) => ({
          ...prevState,
          battleLog: [...prevState.battleLog, `The weather has changed to ${newWeatherEffect.name}!`],
        }));
      }

      const weatherUpdatedState = applyWeatherEffect(battleState, weatherEffect);
      updateBattleState(weatherUpdatedState);

      if (Math.random() < 0.1) {
        const randomEvent = getRandomEvent();
        const updatedState = applyRandomEvent(battleState, randomEvent);
        updateBattleState(updatedState);
        setRandomEvents([...randomEvents, randomEvent]);
      }
    };

    applyEffects();
  }, [battleState.roundCount, weatherEffect]);

  const handleAction = async (action) => {
    const newState = performPlayerAction(action, battleState, playerTeddyData, opponentTeddyData);
    updateBattleState(newState);
    return newState;
  };

  const handlePowerUp = () => {
    if (battleState.powerUpMeter === 100) {
      updateBattleState({
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
    aiAction,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
    randomEvents,
    weatherEffect,
  };
};

const getRandomEvent = () => {
  const events = [
    { name: 'Sudden Gust', effect: (state) => ({ ...state, playerDefenseBoost: state.playerDefenseBoost - 2, opponentDefenseBoost: state.opponentDefenseBoost - 2 }) },
    { name: 'Energy Surge', effect: (state) => ({ ...state, playerEnergy: state.playerEnergy + 1, opponentEnergy: state.opponentEnergy + 1 }) },
    { name: 'Healing Mist', effect: (state) => ({ ...state, playerHealth: Math.min(100, state.playerHealth + 10), opponentHealth: Math.min(100, state.opponentHealth + 10) }) },
    { name: 'Rage Inducer', effect: (state) => ({ ...state, rage: Math.min(100, state.rage + 20), aiRage: Math.min(100, state.aiRage + 20) }) },
    { name: 'Stuffing Storm', effect: (state) => ({ ...state, playerAttackBoost: state.playerAttackBoost + 3, opponentAttackBoost: state.opponentAttackBoost + 3 }) },
  ];
  return events[Math.floor(Math.random() * events.length)];
};

const applyRandomEvent = (state, event) => {
  const newState = event.effect(state);
  newState.battleLog.push(`Random event: ${event.name}!`);
  return newState;
};
