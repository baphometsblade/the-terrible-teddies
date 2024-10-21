import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/hooks/use-toast";
import { TeddyCard, PowerUp, WeatherEffect } from '../types/types';
import { Button } from "@/components/ui/button";
import { useBattleActions } from '../hooks/useBattleActions';
import { useBattleState } from '../hooks/useBattleState';
import TeddyCardComponent from './TeddyCard';
import WeatherEffectComponent from './WeatherEffectComponent';
import PowerUpComponent from './PowerUpComponent';

interface BattleArenaProps {
  playerTeddy: TeddyCard;
  opponentTeddy: TeddyCard;
}

const BattleArena: React.FC<BattleArenaProps> = ({ playerTeddy, opponentTeddy }) => {
  const { toast } = useToast();
  const [battleState, updateBattleState] = useBattleState(playerTeddy, opponentTeddy);
  const { performAttack, performDefend, performSpecialMove, usePowerUp } = useBattleActions(battleState, updateBattleState);

  useEffect(() => {
    if (battleState.playerHealth <= 0 || battleState.opponentHealth <= 0) {
      const winner = battleState.playerHealth > 0 ? playerTeddy.name : opponentTeddy.name;
      toast({
        title: "Battle Ended",
        description: `${winner} wins the battle!`,
        variant: "success",
      });
    }
  }, [battleState.playerHealth, battleState.opponentHealth, playerTeddy.name, opponentTeddy.name, toast]);

  const handlePlayerAction = async (action: 'attack' | 'defend' | 'special') => {
    let result;
    switch (action) {
      case 'attack':
        result = await performAttack();
        break;
      case 'defend':
        result = await performDefend();
        break;
      case 'special':
        result = await performSpecialMove();
        break;
    }

    if (result) {
      toast({
        title: "Action Performed",
        description: result.message,
      });
    }
  };

  const handleUsePowerUp = (powerUp: PowerUp) => {
    const result = usePowerUp(powerUp);
    if (result) {
      toast({
        title: "Power-Up Used",
        description: result.message,
      });
    }
  };

  return (
    <motion.div 
      className="battle-arena p-4 bg-amber-100 rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <WeatherEffectComponent weather={battleState.weatherEffect} />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
          <TeddyCardComponent teddy={playerTeddy} />
          <p>Health: {battleState.playerHealth}</p>
          <p>Energy: {battleState.playerEnergy}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
          <TeddyCardComponent teddy={opponentTeddy} />
          <p>Health: {battleState.opponentHealth}</p>
          <p>Energy: {battleState.opponentEnergy}</p>
        </div>
      </div>
      <div className="flex justify-center space-x-2 mb-4">
        <Button onClick={() => handlePlayerAction('attack')} disabled={battleState.playerEnergy < 1}>Attack</Button>
        <Button onClick={() => handlePlayerAction('defend')} disabled={battleState.playerEnergy < 1}>Defend</Button>
        <Button onClick={() => handlePlayerAction('special')} disabled={battleState.playerEnergy < 2}>Special Move</Button>
      </div>
      <div className="power-ups grid grid-cols-3 gap-2">
        {battleState.availablePowerUps.map((powerUp) => (
          <PowerUpComponent key={powerUp.id} powerUp={powerUp} onUse={handleUsePowerUp} />
        ))}
      </div>
      <div className="battle-log mt-4">
        <h3 className="text-lg font-bold mb-2">Battle Log</h3>
        <ul className="list-disc list-inside">
          {battleState.battleLog.slice(-5).map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

export default BattleArena;