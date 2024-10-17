import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleStatus from './BattleStatus';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import WeatherEffect from './WeatherEffect';
import CombatLog from './CombatLog';
import PowerUpSystem from './PowerUpSystem';
import { useBattleLogic } from '../../hooks/useBattleLogic';

const BattleArena = () => {
  const { toast } = useToast();
  const {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
    randomEvents,
    weatherEffect,
  } = useBattleLogic();

  const [showPowerUpSystem, setShowPowerUpSystem] = useState(false);

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      toast({
        title: "Battle Ended",
        description: `${winner} wins the battle!`,
        variant: winner === playerTeddyData.name ? "success" : "destructive",
      });
    }
  }, [battleState.playerHealth, battleState.opponentHealth, playerTeddyData, opponentTeddyData, toast]);

  if (isLoadingPlayerTeddy || isLoadingOpponentTeddy) {
    return <div>Loading battle data...</div>;
  }

  return (
    <motion.div 
      className="battle-arena p-4 bg-amber-100 rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <WeatherEffect weather={weatherEffect} />
      <BattleField
        battleState={battleState}
        playerTeddyData={playerTeddyData}
        opponentTeddyData={opponentTeddyData}
      />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <ActionButtons
            onAction={handleAction}
            currentTurn={battleState.currentTurn}
            playerEnergy={battleState.playerEnergy}
          />
          <motion.button
            className="mt-2 bg-purple-500 text-white px-4 py-2 rounded"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPowerUpSystem(!showPowerUpSystem)}
          >
            {showPowerUpSystem ? 'Hide Power-Ups' : 'Show Power-Ups'}
          </motion.button>
        </div>
        <div>
          <PowerUpMeter value={battleState.powerUpMeter} onPowerUp={handlePowerUp} />
          <ComboMeter value={battleState.comboMeter} onCombo={handleCombo} />
        </div>
      </div>
      <AnimatePresence>
        {showPowerUpSystem && (
          <PowerUpSystem
            powerUps={battleState.availablePowerUps}
            onUsePowerUp={(powerUp) => {
              handlePowerUp(powerUp);
              setShowPowerUpSystem(false);
            }}
          />
        )}
      </AnimatePresence>
      <BattleStatus battle={battleState} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <BattleLog battleLog={battleState.battleLog} />
        <CombatLog combatEvents={battleState.combatEvents} />
      </div>
    </motion.div>
  );
};

export default BattleArena;