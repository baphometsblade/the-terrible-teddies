import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { useAchievements } from '../../hooks/useAchievements';
import BattleField from './BattleField';
import BattleActions from './BattleActions';
import BattleLog from './BattleLog';
import ComboMeter from './ComboMeter';
import WeatherDisplay from './WeatherSystem/WeatherDisplay';
import BattleAnimation from './BattleAnimation';
import AchievementPopup from '../Achievement/AchievementPopup';
import PowerUpDisplay from './PowerUps/PowerUpDisplay';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { checkAchievements } from '../../utils/achievementSystem';
import { powerUps, activatePowerUp } from '../../utils/powerUpSystem';
import { getRandomWeather, applyWeatherEffect } from '../../utils/weatherSystem';
import confetti from 'canvas-confetti';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd, userId }) => {
  const {
    battleState,
    playerTeddyData,
    opponentTeddyData,
    performAction,
    updateBattleState
  } = useBattleLogic(playerTeddy, opponentTeddy);

  const {
    unlockedAchievements,
    unlockAchievement,
    currentAchievement,
    showAchievement
  } = useAchievements(userId);

  const [animation, setAnimation] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize random weather at battle start
    if (!battleState.weatherEffect) {
      const initialWeather = getRandomWeather();
      updateBattleState({
        weatherEffect: initialWeather.name,
        weatherDuration: initialWeather.duration,
        battleLog: [...battleState.battleLog, `The weather changes to ${initialWeather.name}!`]
      });
    }
  }, []);

  useEffect(() => {
    // Update weather on turn end
    if (battleState.weatherDuration <= 0 && battleState.weatherEffect) {
      const newWeather = getRandomWeather();
      updateBattleState({
        weatherEffect: newWeather.name,
        weatherDuration: newWeather.duration,
        battleLog: [...battleState.battleLog, `The weather changes to ${newWeather.name}!`]
      });
    }
  }, [battleState.weatherDuration]);

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

  return (
    <div className="battle-container p-4 bg-gray-100 rounded-lg shadow-lg">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Battle</h2>
        {battleState.weatherEffect && (
          <WeatherDisplay
            weather={battleState.weatherEffect}
            duration={battleState.weatherDuration}
          />
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2">
          <BattleField
            battleState={battleState}
            playerTeddyData={playerTeddyData}
            opponentTeddyData={opponentTeddyData}
            animation={animation}
          />
        </div>
        
        <div className="space-y-4">
          <PowerUpDisplay
            availablePowerUps={powerUps}
            onActivate={handlePowerUpActivation}
            currentEnergy={battleState.playerEnergy}
          />
          <ComboMeter value={battleState.comboCount} />
          <BattleActions
            onAction={performAction}
            playerEnergy={battleState.playerEnergy}
            isPlayerTurn={battleState.currentTurn === 'player'}
          />
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

      {animation && <BattleAnimation type={animation} />}
    </div>
  );
};

export default Battle;
