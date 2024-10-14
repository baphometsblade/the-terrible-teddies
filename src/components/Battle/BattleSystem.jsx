import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import BattleField from './BattleField';
import BattleActions from './BattleActions';
import BattleLog from './BattleLog';
import { useBattleLogic } from '../../hooks/useBattleLogic';

const BattleSystem = ({ playerTeddy, opponentTeddy }) => {
  const {
    battleState,
    handleAction,
    handleOpponentTurn,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData
  } = useBattleLogic(playerTeddy, opponentTeddy);

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      alert(`Battle ended! ${winner} wins!`);
      // Here you would typically update the database, award XP, etc.
    }
  }, [battleState.playerHealth, battleState.opponentHealth, playerTeddyData, opponentTeddyData]);

  if (isLoadingPlayerTeddy || isLoadingOpponentTeddy) {
    return <div>Loading battle data...</div>;
  }

  return (
    <div className="battle-system p-4 bg-gray-100 rounded-lg shadow-lg">
      <BattleField
        battleState={battleState}
        playerTeddyData={playerTeddyData}
        opponentTeddyData={opponentTeddyData}
      />
      <BattleActions
        currentTurn={battleState.currentTurn}
        playerEnergy={battleState.playerEnergy}
        onAction={handleAction}
      />
      <BattleLog battleLog={battleState.battleLog} />
    </div>
  );
};

export default BattleSystem;