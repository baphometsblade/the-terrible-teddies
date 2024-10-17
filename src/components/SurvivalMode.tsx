import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBattleLogic } from '../hooks/useBattleLogic';
import BattleArena from './BattleArena/BattleArena';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const SurvivalMode: React.FC = () => {
  const [wave, setWave] = useState(1);
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
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
  } = useBattleLogic();

  useEffect(() => {
    // Initialize player teddy and first opponent
    setPlayerTeddy(/* Fetch player's selected teddy */);
    generateOpponent();
  }, []);

  const generateOpponent = () => {
    // Generate a new opponent teddy with increasing difficulty based on the wave
    const newOpponent = {
      // ... generate opponent stats
    };
    setOpponentTeddy(newOpponent);
  };

  const handleWaveComplete = () => {
    setWave(wave + 1);
    toast({
      title: "Wave Complete!",
      description: `You've survived wave ${wave}. Prepare for the next challenge!`,
      variant: "success",
    });
    generateOpponent();
  };

  const handleGameOver = () => {
    toast({
      title: "Game Over",
      description: `You've survived ${wave} waves in Survival Mode!`,
      variant: "destructive",
    });
    // Handle game over logic (e.g., save high score, return to menu)
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
      <BattleArena
        playerTeddy={playerTeddyData}
        opponentTeddy={opponentTeddyData}
        battleState={battleState}
        onAction={handleAction}
        onPowerUp={handlePowerUp}
        onCombo={handleCombo}
      />
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