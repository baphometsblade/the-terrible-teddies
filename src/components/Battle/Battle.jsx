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
import { motion, AnimatePresence } from 'framer-motion';
import { getWeatherEffect } from '../../utils/battleUtils';
import { useSound } from '../../hooks/useSound';
import BattleAnimation from './BattleAnimation';
import BattleItems from './BattleItems';
import WeatherEffect from './WeatherEffect';
import BattleStats from './BattleStats';
import CrowdReaction from './CrowdReaction';
import WeatherForecast from './WeatherForecast';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const {
    battleState,
    performAction,
    handlePowerUp,
    handleCombo,
    isLoading,
    error
  } = useBattleLogic(playerTeddy, opponentTeddy);

  const [animation, setAnimation] = useState(null);
  const [crowdMood, setCrowdMood] = useState('neutral');
  const { playSound } = useSound();

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      playSound(battleState.playerHealth > 0 ? 'victory' : 'defeat');
      onBattleEnd(battleState.playerHealth > 0 ? 'win' : 'lose');
    }
  }, [battleState.playerHealth, battleState.opponentHealth, onBattleEnd, playSound]);

  useEffect(() => {
    if (battleState.roundCount % 5 === 0) {
      playSound('weatherChange');
    }
  }, [battleState.roundCount, playSound]);

  useEffect(() => {
    // Update crowd mood based on battle state
    if (battleState.playerHealth > battleState.opponentHealth + 20) {
      setCrowdMood('excited');
    } else if (battleState.opponentHealth > battleState.playerHealth + 20) {
      setCrowdMood('worried');
    } else {
      setCrowdMood('neutral');
    }
  }, [battleState.playerHealth, battleState.opponentHealth]);

  const handleActionWithAnimation = (action) => {
    setAnimation(action);
    performAction(action);
    playSound(action);
    setTimeout(() => setAnimation(null), 1000);
  };

  if (isLoading) return <div>Loading battle data...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <motion.div 
      className="battle-arena bg-gray-100 p-6 rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <WeatherEffect weatherEffect={battleState.weatherEffect} />
      <WeatherForecast currentWeather={battleState.weatherEffect} roundCount={battleState.roundCount} />

      <BattleField battleState={battleState} />
      
      <AnimatePresence>
        {animation && (
          <BattleAnimation action={animation} attacker={battleState.currentTurn === 'player' ? playerTeddy : opponentTeddy} />
        )}
      </AnimatePresence>

      <div className="battle-actions mb-4">
        {battleState.currentTurn === 'player' && (
          <>
            <ActionButtons 
              onAction={handleActionWithAnimation}
              onPowerUp={handlePowerUp}
              onCombo={handleCombo}
              powerUpReady={battleState.powerUpMeter === 100}
              comboReady={battleState.comboMeter === 100}
            />
            <BattleItems 
              items={battleState.playerItems}
              onUseItem={(index) => handleActionWithAnimation(`use_item_${index}`)}
            />
          </>
        )}
      </div>

      <div className="flex justify-between mb-4">
        <PowerUpMeter value={battleState.powerUpMeter} />
        <ComboMeter value={battleState.comboMeter} />
      </div>

      <BattleLog log={battleState.battleLog} />
      <BattleStats battleState={battleState} />
      <CrowdReaction mood={crowdMood} />
    </motion.div>
  );
};

export default Battle;