import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import TeddyCard from '../TeddyCard';
import BattleEffects from './BattleEffects';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { calculateDamage, applyPowerUp, checkForCombo } from '../../utils/battleUtils';
import { checkAchievements } from '../../utils/achievementSystem';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(100);
  const [opponentHealth, setOpponentHealth] = useState(100);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const [showEffects, setShowEffects] = useState(false);
  const [powerUpMeter, setPowerUpMeter] = useState(0);
  const [comboMeter, setComboMeter] = useState(0);
  const [moveHistory, setMoveHistory] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const { toast } = useToast();

  const { data: playerTeddyData } = useQuery({
    queryKey: ['teddy', playerTeddy.id],
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

  const { data: opponentTeddyData } = useQuery({
    queryKey: ['teddy', opponentTeddy.id],
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

  useEffect(() => {
    if (playerHealth <= 0 || opponentHealth <= 0) {
      const winner = playerHealth > 0 ? 'player' : 'opponent';
      onBattleEnd(winner);
    }
  }, [playerHealth, opponentHealth, onBattleEnd]);

  const performAction = (action) => {
    let damage = 0;
    let logMessage = '';

    if (action === 'attack') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData);
      if (currentTurn === 'player') {
        setOpponentHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${playerTeddyData.name} attacks for ${damage} damage!`;
      } else {
        setPlayerHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!`;
      }
    } else if (action === 'special') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData) * 1.5;
      if (currentTurn === 'player') {
        setOpponentHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${playerTeddyData.name} uses ${playerTeddyData.special_move} for ${damage} damage!`;
      } else {
        setPlayerHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${opponentTeddyData.name} uses ${opponentTeddyData.special_move} for ${damage} damage!`;
      }
    } else if (action === 'defend') {
      const defenseBoost = Math.floor(Math.random() * 10) + 5;
      if (currentTurn === 'player') {
        setPlayerHealth((prev) => Math.min(100, prev + defenseBoost));
        logMessage = `${playerTeddyData.name} defends and recovers ${defenseBoost} health!`;
      } else {
        setOpponentHealth((prev) => Math.min(100, prev + defenseBoost));
        logMessage = `${opponentTeddyData.name} defends and recovers ${defenseBoost} health!`;
      }
    }

    setBattleLog((prev) => [...prev, logMessage]);
    setShowEffects(true);
    setTimeout(() => setShowEffects(false), 1000);
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');

    // Update power-up and combo meters
    setPowerUpMeter((prev) => Math.min(prev + 10, 100));
    setMoveHistory((prev) => [...prev, action]);
    const combo = checkForCombo(moveHistory);
    if (combo) {
      setComboMeter(0);
      // Apply combo effect
      const comboMessage = `${currentTurn === 'player' ? playerTeddyData.name : opponentTeddyData.name} activates ${combo.name} combo!`;
      setBattleLog((prev) => [...prev, comboMessage]);
    } else {
      setComboMeter((prev) => Math.min(prev + 20, 100));
    }

    // Check for achievements
    const newAchievements = checkAchievements(action, damage, playerHealth, opponentHealth);
    if (newAchievements.length > 0) {
      setAchievements((prev) => [...prev, ...newAchievements]);
      newAchievements.forEach((achievement) => {
        toast({
          title: "Achievement Unlocked!",
          description: achievement.name,
        });
      });
    }

    if (currentTurn === 'opponent') {
      setTimeout(() => {
        const aiAction = chooseAIAction();
        performAction(aiAction);
      }, 1500);
    }
  };

  const chooseAIAction = () => {
    const actions = ['attack', 'special', 'defend'];
    const weights = [
      opponentHealth > 50 ? 0.6 : 0.3,
      comboMeter === 100 ? 0.5 : 0.2,
      opponentHealth < 30 ? 0.5 : 0.2
    ];
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const randomValue = Math.random() * totalWeight;
    let weightSum = 0;
    for (let i = 0; i < actions.length; i++) {
      weightSum += weights[i];
      if (randomValue <= weightSum) {
        return actions[i];
      }
    }
    return 'attack'; // Fallback
  };

  const handlePowerUp = () => {
    if (powerUpMeter === 100) {
      const powerUp = applyPowerUp(currentTurn === 'player' ? playerTeddyData : opponentTeddyData);
      setBattleLog((prev) => [...prev, `${currentTurn === 'player' ? playerTeddyData.name : opponentTeddyData.name} activates ${powerUp.name}!`]);
      setPowerUpMeter(0);
    }
  };

  if (!playerTeddyData || !opponentTeddyData) {
    return <div>Loading battle data...</div>;
  }

  return (
    <div className="battle-arena bg-gray-100 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between mb-8">
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <TeddyCard teddy={playerTeddyData} />
          <div className="mt-2 text-center">
            Health: {playerHealth}
          </div>
        </motion.div>
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <TeddyCard teddy={opponentTeddyData} />
          <div className="mt-2 text-center">
            Health: {opponentHealth}
          </div>
        </motion.div>
      </div>
      
      <AnimatePresence>
        {showEffects && <BattleEffects />}
      </AnimatePresence>

      <div className="battle-actions mb-4">
        {currentTurn === 'player' && (
          <div className="flex justify-center space-x-4">
            <Button onClick={() => performAction('attack')}>Attack</Button>
            <Button onClick={() => performAction('special')}>Special Move</Button>
            <Button onClick={() => performAction('defend')}>Defend</Button>
            <Button onClick={handlePowerUp} disabled={powerUpMeter < 100}>Activate Power-Up</Button>
          </div>
        )}
      </div>

      <div className="flex justify-between mb-4">
        <PowerUpMeter value={powerUpMeter} />
        <ComboMeter value={comboMeter} />
      </div>

      <div className="battle-log bg-white p-4 rounded-lg h-40 overflow-y-auto">
        <h3 className="text-lg font-bold mb-2">Battle Log</h3>
        {battleLog.map((log, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {log}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Battle;