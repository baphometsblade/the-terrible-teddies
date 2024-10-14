import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import BattleField from './BattleField';
import BattleActions from './BattleActions';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import BattleAnimation from './BattleAnimation';
import WeatherEffect from './WeatherEffect';
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import confetti from 'canvas-confetti';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
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

  const [animation, setAnimation] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddyData.name : opponentTeddyData.name;
      toast({
        title: "Battle Ended",
        description: `${winner} wins the battle!`,
        variant: winner === playerTeddyData.name ? "success" : "destructive",
      });
      if (winner === playerTeddyData.name) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
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
        <Select onValueChange={setDifficulty} defaultValue={difficulty}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <WeatherEffect weather={battleState.weatherEffect} />
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
      <motion.div
        className="mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button onClick={() => onBattleEnd('forfeit')} variant="outline">
          Forfeit Battle
        </Button>
      </motion.div>
    </div>
  );
};

export default Battle;