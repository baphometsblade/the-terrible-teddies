import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import WeatherEffect from './WeatherEffect';
import CombatLog from './CombatLog';
import PowerUpSystem from './PowerUpSystem';
import PlayerHand from './PlayerHand';
import BattleEffects from './BattleEffects';
import TurnTimer from './TurnTimer';
import BattleRewards from './BattleRewards';
import BattleSummary from './BattleSummary';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { Button } from "@/components/ui/button";

const BattleArena = () => {
  const { toast } = useToast();
  const {
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
  } = useBattleLogic();

  const [showPowerUpSystem, setShowPowerUpSystem] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      toast({
        title: "Battle Ended",
        description: `${winner} wins the battle!`,
        variant: winner === playerTeddyData.name ? "success" : "destructive",
      });
      setShowSummary(true);
    }
  }, [battleState.playerHealth, battleState.opponentHealth, playerTeddyData, opponentTeddyData, toast]);

  const handleTurnEnd = () => {
    endTurn();
    setTimeout(aiAction, 1000);
  };

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
      <PlayerHand 
        hand={battleState.playerHand} 
        onPlayCard={playCard} 
        isPlayerTurn={battleState.currentTurn === 'player'}
        playerEnergy={battleState.playerEnergy}
      />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <ActionButtons
            onAction={handleAction}
            onSpecialAbility={handleSpecialAbility}
            currentTurn={battleState.currentTurn}
            playerEnergy={battleState.playerEnergy}
          />
          <Button
            onClick={drawCard}
            disabled={battleState.currentTurn !== 'player' || battleState.playerHand.length >= 7}
            className="mt-2 bg-blue-500 hover:bg-blue-600 text-white"
          >
            Draw Card
          </Button>
          <Button
            onClick={handleTurnEnd}
            disabled={battleState.currentTurn !== 'player'}
            className="mt-2 bg-green-500 hover:bg-green-600 text-white"
          >
            End Turn
          </Button>
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
          <TurnTimer
            isPlayerTurn={battleState.currentTurn === 'player'}
            onTimeUp={handleTurnEnd}
          />
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
      <BattleEffects effects={battleState.activeEffects} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <BattleLog battleLog={battleState.battleLog} />
        <CombatLog combatEvents={battleState.combatEvents} />
      </div>
      {showSummary && (
        <BattleSummary
          winner={battleState.playerHealth > 0 ? 'player' : 'opponent'}
          playerTeddy={playerTeddyData}
          opponentTeddy={opponentTeddyData}
          battleState={battleState}
          onClose={() => {
            setShowSummary(false);
            setShowRewards(true);
          }}
        />
      )}
      {showRewards && (
        <BattleRewards
          winner={battleState.playerHealth > 0 ? 'player' : 'opponent'}
          onClose={() => setShowRewards(false)}
        />
      )}
    </motion.div>
  );
};

export default BattleArena;