import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from 'framer-motion';
import { Zap, Shield, Swords } from 'lucide-react';
import TeddyCard from '../TeddyCard';

const BattleSystem = ({ playerTeddy, opponentTeddy }) => {
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

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      // Handle end of battle
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      alert(`Battle ended! ${winner} wins!`);
      // Here you would typically update the database, award XP, etc.
    }
  }, [battleState.playerHealth, battleState.opponentHealth]);

  if (isLoadingPlayerTeddy || isLoadingOpponentTeddy) {
    return <div>Loading battle data...</div>;
  }

  return (
    <div className="battle-system p-4 bg-gray-100 rounded-lg shadow-lg">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>{playerTeddyData.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <TeddyCard teddy={playerTeddyData} />
            <Progress value={(battleState.playerHealth / 100) * 100} className="mt-2" />
            <div className="flex justify-between mt-2">
              <span><Zap className="inline mr-1" /> {battleState.playerEnergy}</span>
              <span><Shield className="inline mr-1" /> {playerTeddyData.defense}</span>
              <span><Swords className="inline mr-1" /> {playerTeddyData.attack}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{opponentTeddyData.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <TeddyCard teddy={opponentTeddyData} />
            <Progress value={(battleState.opponentHealth / 100) * 100} className="mt-2" />
            <div className="flex justify-between mt-2">
              <span><Zap className="inline mr-1" /> {battleState.opponentEnergy}</span>
              <span><Shield className="inline mr-1" /> {opponentTeddyData.defense}</span>
              <span><Swords className="inline mr-1" /> {opponentTeddyData.attack}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="battle-actions mb-4">
        <Button onClick={() => handleAction('attack')} disabled={battleState.currentTurn !== 'player'} className="mr-2">
          Attack
        </Button>
        <Button onClick={() => handleAction('defend')} disabled={battleState.currentTurn !== 'player'} className="mr-2">
          Defend
        </Button>
        <Button onClick={() => handleAction('special')} disabled={battleState.currentTurn !== 'player' || battleState.playerEnergy < 2}>
          Special Move
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Battle Log</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5">
            {battleState.battleLog.slice(-5).map((log, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {log}
              </motion.li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default BattleSystem;