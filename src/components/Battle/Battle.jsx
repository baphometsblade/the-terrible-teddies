import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '../../hooks/useSound';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import BattleField from './BattleField';
import ActionButtons from './ActionButtons';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import BattleAnimation from './BattleAnimation';
import BattleItems from './BattleItems';
import WeatherEffect from './WeatherEffect';
import BattleStats from './BattleStats';
import CrowdReaction from './CrowdReaction';
import WeatherForecast from './WeatherForecast';
import TeddyEvolution from './TeddyEvolution';
import BattleArenaBackground from './BattleArenaBackground';
import SpecialAbility from './SpecialAbility';
import { checkAchievements } from '../../utils/achievementSystem';
import { applyBattleEvent } from '../../utils/battleEvents';
import { checkForCombo, applyComboEffect } from '../../utils/comboSystem';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Zap, Shield, Swords } from 'lucide-react';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const {
    battleState,
    performAction,
    handlePowerUp,
    handleCombo,
    handleSpecialAbility,
    isLoading,
    error
  } = useBattleLogic(playerTeddy, opponentTeddy);

  const [animation, setAnimation] = useState(null);
  const [crowdMood, setCrowdMood] = useState('neutral');
  const { playSound } = useSound();
  const [achievements, setAchievements] = useState([]);
  const [comboMoves, setComboMoves] = useState([]);

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      playSound(battleState.playerHealth > 0 ? 'victory' : 'defeat');
      onBattleEnd(battleState.playerHealth > 0 ? 'win' : 'lose');
      checkAchievements().then(newAchievements => setAchievements(newAchievements));
    }
  }, [battleState.playerHealth, battleState.opponentHealth, onBattleEnd, playSound]);

  useEffect(() => {
    if (battleState.roundCount % 5 === 0) {
      playSound('weatherChange');
    }
    if (battleState.roundCount % 3 === 0) {
      const updatedState = applyBattleEvent(battleState);
      // Update the battle state with the new event effects
    }
  }, [battleState.roundCount, playSound]);

  useEffect(() => {
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
    setComboMoves([...comboMoves, action]);
    setTimeout(() => setAnimation(null), 1000);

    const combo = checkForCombo(comboMoves);
    if (combo) {
      const comboEffect = applyComboEffect(combo, playerTeddy, opponentTeddy);
      // Apply combo effect to battle state
      playSound('combo');
    }
  };

  if (isLoading) return <div className="text-center p-8">Loading battle data...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error.message}</div>;

  return (
    <motion.div 
      className="battle-arena relative overflow-hidden rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <BattleArenaBackground weatherEffect={battleState.weatherEffect} />
      
      <div className="relative z-10 p-6">
        <WeatherEffect weatherEffect={battleState.weatherEffect} />
        <WeatherForecast currentWeather={battleState.weatherEffect} roundCount={battleState.roundCount} />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <TeddyEvolution teddy={playerTeddy} isEvolved={battleState.playerIsEvolved} />
              <Progress value={(battleState.playerHealth / playerTeddy.maxHealth) * 100} className="mt-2" />
              <div className="flex justify-between mt-2">
                <span><Zap className="inline mr-1" /> {battleState.playerEnergy}</span>
                <span><Shield className="inline mr-1" /> {battleState.playerDefense}</span>
                <span><Swords className="inline mr-1" /> {battleState.playerAttack}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <TeddyEvolution teddy={opponentTeddy} isEvolved={battleState.opponentIsEvolved} />
              <Progress value={(battleState.opponentHealth / opponentTeddy.maxHealth) * 100} className="mt-2" />
              <div className="flex justify-between mt-2">
                <span><Zap className="inline mr-1" /> {battleState.opponentEnergy}</span>
                <span><Shield className="inline mr-1" /> {battleState.opponentDefense}</span>
                <span><Swords className="inline mr-1" /> {battleState.opponentAttack}</span>
              </div>
            </CardContent>
          </Card>
        </div>

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
              <SpecialAbility
                ability={playerTeddy.specialAbility}
                onUse={() => handleSpecialAbility(playerTeddy.specialAbility)}
                isDisabled={battleState.playerEnergy < playerTeddy.specialAbility.energyCost}
              />
              <BattleItems 
                items={battleState.playerItems}
                onUseItem={(index) => handleActionWithAnimation(`use_item_${index}`)}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <PowerUpMeter value={battleState.powerUpMeter} />
          <ComboMeter value={battleState.comboMeter} />
        </div>

        <BattleLog log={battleState.battleLog} />
        <BattleStats battleState={battleState} />
        <CrowdReaction mood={crowdMood} />

        <AnimatePresence>
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ delay: index * 0.5 }}
              className="achievement-popup bg-yellow-100 border-2 border-yellow-300 p-4 rounded-lg mb-2"
            >
              <h3 className="text-lg font-bold">{achievement.name}</h3>
              <p>{achievement.description}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Battle;