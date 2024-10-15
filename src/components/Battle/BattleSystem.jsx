import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import BattleField from './BattleField';
import BattleActions from './BattleActions';
import BattleLog from './BattleLog';
import PowerUpMeter from './PowerUpMeter';
import ComboMeter from './ComboMeter';
import WeatherEffect from './WeatherEffect';
import RandomEventDisplay from './RandomEventDisplay';
import BattleStats from './BattleStats';
import BattleTimer from './BattleTimer';
import TeddyTraits from './TeddyTraits';
import BattleEffects from './BattleEffects';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const BattleSystem = ({ playerTeddy }) => {
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const { toast } = useToast();
  const {
    battleState,
    handleAction,
    handlePowerUp,
    handleCombo,
    isLoadingPlayerTeddy,
    isLoadingOpponentTeddy,
    playerTeddyData,
    opponentTeddyData,
    aiAction,
    randomEvents,
  } = useBattleLogic(playerTeddy, opponentTeddy);

  const [battleAnimation, setBattleAnimation] = useState(null);
  const [showRewards, setShowRewards] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const { data: opponents, isLoading: isLoadingOpponents } = useQuery({
    queryKey: ['opponents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terrible_teddies')
        .select('*')
        .neq('id', playerTeddy.id)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!playerTeddy,
  });

  useEffect(() => {
    if (opponents && opponents.length > 0) {
      const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
      setOpponentTeddy(randomOpponent);
    }
  }, [opponents]);

  const handleBattleEnd = async (result) => {
    setGameOver(true);
    toast({
      title: result === 'win' ? "Victory!" : "Defeat",
      description: result === 'win' ? "You won the battle!" : "You lost the battle.",
      variant: result === 'win' ? "success" : "destructive",
    });

    if (result === 'win') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    // Update player stats
    const { data: playerStats, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', playerTeddy.player_id)
      .single();

    if (!error) {
      await supabase
        .from('player_stats')
        .update({
          battles_fought: playerStats.battles_fought + 1,
          battles_won: result === 'win' ? playerStats.battles_won + 1 : playerStats.battles_won,
        })
        .eq('player_id', playerTeddy.player_id);
    }

    // Award XP to the player's teddy
    if (result === 'win') {
      await supabase
        .from('player_teddies')
        .update({ xp: playerTeddy.xp + 10 })
        .eq('id', playerTeddy.id);
    }

    setShowRewards(true);
  };

  const handlePlayerAction = async (action) => {
    if (gameOver) return;

    setBattleAnimation(action);
    const newState = await handleAction(action);
    setTimeout(() => setBattleAnimation(null), 1000);

    if (newState.opponentHealth <= 0) {
      handleBattleEnd('win');
      return;
    }

    // AI opponent's turn
    setTimeout(async () => {
      const aiActionResult = await aiAction();
      setBattleAnimation(aiActionResult.action);
      setTimeout(() => setBattleAnimation(null), 1000);

      if (aiActionResult.newState.playerHealth <= 0) {
        handleBattleEnd('lose');
      }
    }, 1500);
  };

  const handleTimeUp = () => {
    if (gameOver) return;
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    handlePlayerAction(randomAction);
  };

  if (isLoadingPlayerTeddy || isLoadingOpponentTeddy || !opponentTeddy) {
    return <div className="text-center p-8">Loading battle data...</div>;
  }

  return (
    <motion.div 
      className="battle-system p-4 bg-gray-100 rounded-lg shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <WeatherEffect weather={battleState.weatherEffect} />
        <BattleTimer duration={30} onTimeUp={handleTimeUp} />
      </div>
      <BattleField
        battleState={battleState}
        playerTeddyData={playerTeddyData}
        opponentTeddyData={opponentTeddyData}
      />
      <AnimatePresence>
        {battleAnimation && (
          <BattleAnimation
            action={battleAnimation}
            attacker={battleState.currentTurn === 'player' ? playerTeddyData : opponentTeddyData}
          />
        )}
      </AnimatePresence>
      <BattleEffects effect={battleState.currentEffect} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <TeddyTraits teddy={playerTeddyData} />
        <TeddyTraits teddy={opponentTeddyData} />
      </div>
      <BattleActions
        currentTurn={battleState.currentTurn}
        playerEnergy={battleState.playerEnergy}
        onAction={handlePlayerAction}
        rage={battleState.rage}
        disabled={gameOver}
      />
      <div className="flex justify-between mt-4">
        <PowerUpMeter value={battleState.powerUpMeter} onPowerUp={handlePowerUp} disabled={gameOver} />
        <ComboMeter value={battleState.comboMeter} onCombo={handleCombo} disabled={gameOver} />
      </div>
      <BattleLog battleLog={battleState.battleLog} />
      <RandomEventDisplay events={randomEvents} />
      <BattleStats battleState={battleState} />
      {showRewards && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
        >
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Battle Rewards</h2>
            <p>XP Gained: 10</p>
            <p>Coins Earned: 50</p>
            <Button onClick={() => setShowRewards(false)} className="mt-4">Close</Button>
          </div>
        </motion.div>
      )}
      {gameOver && (
        <div className="mt-4 text-center">
          <Button onClick={() => window.location.reload()} className="bg-green-500 hover:bg-green-600 text-white">
            Play Again
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default BattleSystem;