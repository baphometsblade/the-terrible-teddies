import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import WeatherEffect from './WeatherEffect';
import BattleEffects from './BattleEffects';
import TurnTimer from './TurnTimer';
import BattleRewards from './BattleRewards';
import BattleSummary from './BattleSummary';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { Button } from "@/components/ui/button";

const BattleArena: React.FC = () => {
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
    weatherEffect,
  } = useBattleLogic();

  const [showPowerUpSystem, setShowPowerUpSystem] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);

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

  const handlePlayerAction = async (action: string) => {
    setCurrentAnimation(action);
    await handleAction(action);
    setTimeout(() => setCurrentAnimation(null), 500);
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
        currentAnimation={currentAnimation}
      />
      <ActionButtons
        onAction={handlePlayerAction}
        onSpecialAbility={handleSpecialAbility}
        currentTurn={battleState.currentTurn}
        playerEnergy={battleState.playerEnergy}
      />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <PowerUpMeter value={battleState.powerUpMeter} onPowerUp={handlePowerUp} />
        <ComboMeter value={battleState.comboMeter} onCombo={handleCombo} />
      </div>
      <TurnTimer
        isPlayerTurn={battleState.currentTurn === 'player'}
        onTimeUp={handleTurnEnd}
      />
      <BattleEffects effects={battleState.activeEffects} />
      <BattleLog battleLog={battleState.battleLog} />
      <AnimatePresence>
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
      </AnimatePresence>
    </motion.div>
  );
};

export default BattleArena;