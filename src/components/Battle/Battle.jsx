import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import TeddyCard from '../TeddyCard';
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { motion } from 'framer-motion';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const {
    battleState,
    performAction,
    handlePowerUp,
    handleCombo,
    battleLog,
    powerUpMeter,
    comboMeter,
    currentTurn,
    isLoading,
    error
  } = useBattleLogic(playerTeddy, opponentTeddy);

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      onBattleEnd(battleState.playerHealth > 0 ? 'win' : 'lose');
    }
  }, [battleState.playerHealth, battleState.opponentHealth, onBattleEnd]);

  if (isLoading) return <div>Loading battle data...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <motion.div 
      className="battle-arena bg-gray-100 p-6 rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <BattleField battleState={battleState} />
      
      <div className="battle-actions mb-4">
        {currentTurn === 'player' && (
          <ActionButtons 
            onAction={performAction}
            onPowerUp={handlePowerUp}
            onCombo={handleCombo}
            powerUpReady={powerUpMeter === 100}
            comboReady={comboMeter === 100}
          />
        )}
      </div>

      <div className="flex justify-between mb-4">
        <PowerUpMeter value={powerUpMeter} />
        <ComboMeter value={comboMeter} />
      </div>

      <BattleLog log={battleLog} />
    </motion.div>
  );
};

export default Battle;