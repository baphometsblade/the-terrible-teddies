import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { useAchievements } from '../../hooks/useAchievements';
import BattleField from './BattleField';
import BattleActions from './BattleActions';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import BattleAnimation from './BattleAnimation';
import WeatherEffect from './WeatherEffect';
import AchievementPopup from '../Achievement/AchievementPopup';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { checkAchievements } from '../../utils/achievementSystem';
import confetti from 'canvas-confetti';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd, userId }) => {
  const [difficulty, setDifficulty] = useState('medium');
  const {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData
  } = useBattleLogic(playerTeddy, opponentTeddy, difficulty);

  const {
    unlockedAchievements,
    unlockAchievement,
    currentAchievement,
    showAchievement
  } = useAchievements(userId);

  const [animation, setAnimation] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (unlockedAchievements) {
      const newAchievements = checkAchievements(
        battleState,
        playerTeddyData,
        unlockedAchievements
      );

      newAchievements.forEach(achievement => {
        unlockAchievement.mutate(achievement.id);
        showAchievement(achievement);
      });
    }
  }, [battleState, playerTeddyData, unlockedAchievements]);

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      toast({
        title: "Battle Ended",
        description: `${winner} wins the battle!`,
        variant: winner === playerTeddyData.name ? "success" : "destructive",
      });
      onBattleEnd(battleState.playerHealth > 0 ? 'win' : 'lose');
    }
  }, [battleState.playerHealth, battleState.opponentHealth, playerTeddyData, opponentTeddyData, onBattleEnd, toast]);

  const handleActionWithAnimation = (action) => {
    setAnimation(action);
    handleAction(action);
    setTimeout(() => setAnimation(null), 1000);
  };

  if (isLoadingPlayerTeddy || isLoadingOpponentTeddy) {
    return <div>Loading battle data...</div>;
  }

  return (
    <div className="battle-container p-4 bg-gray-100 rounded-lg shadow-lg">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Battle</h2>
        <WeatherEffect weather={battleState.weatherEffect} />
      </div>
      <BattleField
        battleState={battleState}
        playerTeddyData={playerTeddyData}
        opponentTeddyData={opponentTeddyData}
      />
      <AnimatePresence>
        {animation && (
          <BattleAnimation action={animation} attacker={battleState.currentTurn === 'player' ? playerTeddyData : opponentTeddyData} />
        )}
      </AnimatePresence>
      <div className="battle-controls mt-4">
        <BattleActions
          currentTurn={battleState.currentTurn}
          playerEnergy={battleState.playerEnergy}
          onAction={handleActionWithAnimation}
        />
        <div className="flex justify-between mt-2">
          <PowerUpMeter value={battleState.powerUpMeter} onPowerUp={handlePowerUp} />
          <ComboMeter value={battleState.comboMeter} onCombo={handleCombo} />
        </div>
      </div>
      <BattleLog battleLog={battleState.battleLog} />
      <AnimatePresence>
        {currentAchievement && (
          <AchievementPopup
            achievement={currentAchievement}
            onClose={() => showAchievement(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Battle;
