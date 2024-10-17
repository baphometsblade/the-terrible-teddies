import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBattleLogic } from '../hooks/useBattleLogic';
import BattleArena from './BattleArena/BattleArena';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { generateOpponent } from '../utils/opponentGenerator';
import { PowerUp } from '../types/types';
import PowerUpSelection from './PowerUpSelection';
import { generatePowerUps } from '../utils/powerUpSystem';
import { upgradeTeddy } from '../utils/progressionSystem';

const SurvivalMode: React.FC = () => {
  const [wave, setWave] = useState(1);
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [score, setScore] = useState(0);
  const [availablePowerUps, setAvailablePowerUps] = useState<PowerUp[]>([]);
  const [showPowerUpSelection, setShowPowerUpSelection] = useState(false);
  const { toast } = useToast();

  const {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    endBattle,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
    resetBattleState,
  } = useBattleLogic();

  useEffect(() => {
    if (playerTeddyData) {
      setPlayerTeddy(playerTeddyData);
      generateNewOpponent();
    }
  }, [playerTeddyData]);

  const generateNewOpponent = () => {
    const newOpponent = generateOpponent(wave);
    setOpponentTeddy(newOpponent);
  };

  const handleWaveComplete = () => {
    const waveScore = calculateWaveScore();
    setScore(prevScore => prevScore + waveScore);
    setWave(prevWave => prevWave + 1);
    toast({
      title: "Wave Complete!",
      description: `You've survived wave ${wave}. Score: ${waveScore}`,
      variant: "success",
    });
    setShowPowerUpSelection(true);
    resetBattleState();
    generateNewOpponent();
    setAvailablePowerUps(generatePowerUps(3)); // Generate 3 power-ups to choose from
    upgradeTeddy(playerTeddy, wave); // Upgrade player's teddy after each wave
  };

  const handleGameOver = () => {
    toast({
      title: "Game Over",
      description: `You've survived ${wave} waves in Survival Mode! Final Score: ${score}`,
      variant: "destructive",
    });
    // Handle game over logic (e.g., save high score, return to menu)
  };

  const calculateWaveScore = () => {
    const baseScore = 1000;
    const healthBonus = battleState.playerHealth * 10;
    const waveBonus = wave * 500;
    return baseScore + healthBonus + waveBonus;
  };

  const handlePowerUpSelection = (selectedPowerUp: PowerUp) => {
    handlePowerUp(selectedPowerUp);
    setShowPowerUpSelection(false);
  };

  if (isLoadingPlayerTeddy || isLoadingOpponentTeddy) {
    return <div>Loading Survival Mode...</div>;
  }

  return (
    <motion.div
      className="survival-mode p-4 bg-amber-100 rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Survival Mode - Wave {wave}</h2>
      <div className="mb-4">
        <span className="font-bold">Score: {score}</span>
      </div>
      {showPowerUpSelection ? (
        <PowerUpSelection
          powerUps={availablePowerUps}
          onSelect={handlePowerUpSelection}
        />
      ) : (
        <BattleArena
          playerTeddy={playerTeddy}
          opponentTeddy={opponentTeddy}
          battleState={battleState}
          onAction={handleAction}
          onPowerUp={handlePowerUp}
          onCombo={handleCombo}
        />
      )}
      {battleState.playerHealth <= 0 && (
        <Button onClick={handleGameOver} className="mt-4 bg-red-500 hover:bg-red-600 text-white">
          Game Over
        </Button>
      )}
      {battleState.opponentHealth <= 0 && (
        <Button onClick={handleWaveComplete} className="mt-4 bg-green-500 hover:bg-green-600 text-white">
          Next Wave
        </Button>
      )}
    </motion.div>
  );
};

export default SurvivalMode;