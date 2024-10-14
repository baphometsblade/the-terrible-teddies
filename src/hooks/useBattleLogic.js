import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const useBattleLogic = (playerTeddy, opponentTeddy) => {
  const [battleState, setBattleState] = useState({
    playerHealth: 100,
    opponentHealth: 100,
    playerEnergy: 3,
    opponentEnergy: 3,
    currentTurn: 'player',
    battleLog: [],
  });

  const { data: playerTeddyData, isLoading: isLoadingPlayerTeddy } = useQuery({
    queryKey: ['playerTeddy', playerTeddy.id],
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

  const { data: opponentTeddyData, isLoading: isLoadingOpponentTeddy } = useQuery({
    queryKey: ['opponentTeddy', opponentTeddy.id],
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

  const handleAction = (action) => {
    let newBattleState = { ...battleState };
    let damage = 0;
    let energyCost = 1;
    let logMessage = '';

    switch (action) {
      case 'attack':
        damage = Math.floor(Math.random() * 20) + 10;
        newBattleState.opponentHealth -= damage;
        logMessage = `${playerTeddyData.name} attacks for ${damage} damage!`;
        break;
      case 'defend':
        newBattleState.playerHealth += 10;
        logMessage = `${playerTeddyData.name} defends and recovers 10 health!`;
        break;
      case 'special':
        if (newBattleState.playerEnergy >= 2) {
          damage = Math.floor(Math.random() * 30) + 20;
          newBattleState.opponentHealth -= damage;
          energyCost = 2;
          logMessage = `${playerTeddyData.name} uses ${playerTeddyData.special_move} for ${damage} damage!`;
        } else {
          logMessage = "Not enough energy for special move!";
          return;
        }
        break;
      default:
        return;
    }

    newBattleState.playerEnergy -= energyCost;
    newBattleState.battleLog.push(logMessage);
    newBattleState.currentTurn = 'opponent';

    setBattleState(newBattleState);
    updateBattleMutation.mutate(newBattleState);

    // Simulate opponent's turn after a delay
    setTimeout(() => {
      handleOpponentTurn();
    }, 1500);
  };

  const handleOpponentTurn = () => {
    let newBattleState = { ...battleState };
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    let damage = 0;
    let logMessage = '';

    switch (randomAction) {
      case 'attack':
        damage = Math.floor(Math.random() * 20) + 10;
        newBattleState.playerHealth -= damage;
        logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!`;
        break;
      case 'defend':
        newBattleState.opponentHealth += 10;
        logMessage = `${opponentTeddyData.name} defends and recovers 10 health!`;
        break;
      case 'special':
        if (newBattleState.opponentEnergy >= 2) {
          damage = Math.floor(Math.random() * 30) + 20;
          newBattleState.playerHealth -= damage;
          newBattleState.opponentEnergy -= 2;
          logMessage = `${opponentTeddyData.name} uses ${opponentTeddyData.special_move} for ${damage} damage!`;
        } else {
          damage = Math.floor(Math.random() * 20) + 10;
          newBattleState.playerHealth -= damage;
          logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!`;
        }
        break;
    }

    newBattleState.battleLog.push(logMessage);
    newBattleState.currentTurn = 'player';
    newBattleState.playerEnergy = Math.min(newBattleState.playerEnergy + 1, 3);
    newBattleState.opponentEnergy = Math.min(newBattleState.opponentEnergy + 1, 3);

    setBattleState(newBattleState);
    updateBattleMutation.mutate(newBattleState);
  };

  return {
    battleState,
    handleAction,
    handleOpponentTurn,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData
  };
};