import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from "@/hooks/use-toast";
import { TeddyCard } from '../types/types';
import { Button } from "@/components/ui/button";
import { useBattleActions } from '../hooks/useBattleActions';
import TeddyCardComponent from './TeddyCard';

interface BattleArenaProps {
  playerTeddy: TeddyCard;
  opponentTeddy: TeddyCard;
}

const BattleArena: React.FC<BattleArenaProps> = ({ playerTeddy, opponentTeddy }) => {
  const [playerHealth, setPlayerHealth] = useState(20);
  const [opponentHealth, setOpponentHealth] = useState(20);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const { toast } = useToast();
  const { performAttack, performDefend, performSpecialMove } = useBattleActions();

  const handlePlayerAction = async (action: 'attack' | 'defend' | 'special') => {
    let result;
    switch (action) {
      case 'attack':
        result = await performAttack(playerTeddy, opponentTeddy, playerEnergy);
        break;
      case 'defend':
        result = await performDefend(playerTeddy, playerEnergy);
        break;
      case 'special':
        result = await performSpecialMove(playerTeddy, opponentTeddy, playerEnergy);
        break;
    }

    if (result) {
      setOpponentHealth(prev => Math.max(0, prev - result.damage));
      setPlayerEnergy(prev => prev - result.energyCost);
      toast({
        title: "Action Performed",
        description: result.message,
      });

      if (opponentHealth - result.damage <= 0) {
        toast({
          title: "Victory!",
          description: "You've defeated your opponent!",
          variant: "success",
        });
      } else {
        // Opponent's turn logic would go here
      }
    }
  };

  return (
    <motion.div 
      className="battle-arena p-4 bg-amber-100 rounded-lg shadow-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
          <TeddyCardComponent teddy={playerTeddy} />
          <p>Health: {playerHealth}</p>
          <p>Energy: {playerEnergy}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
          <TeddyCardComponent teddy={opponentTeddy} />
          <p>Health: {opponentHealth}</p>
          <p>Energy: {opponentEnergy}</p>
        </div>
      </div>
      <div className="flex justify-center space-x-2">
        <Button onClick={() => handlePlayerAction('attack')} disabled={playerEnergy < 1}>Attack</Button>
        <Button onClick={() => handlePlayerAction('defend')} disabled={playerEnergy < 1}>Defend</Button>
        <Button onClick={() => handlePlayerAction('special')} disabled={playerEnergy < 2}>Special Move</Button>
      </div>
    </motion.div>
  );
};

export default BattleArena;