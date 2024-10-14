import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import TeddyCard from '../TeddyCard';
import BattleEffects from './BattleEffects';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(100);
  const [opponentHealth, setOpponentHealth] = useState(100);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [battleLog, setBattleLog] = useState([]);
  const [showEffects, setShowEffects] = useState(false);
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
      damage = Math.floor(Math.random() * 20) + 10;
      if (currentTurn === 'player') {
        setOpponentHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${playerTeddyData.name} attacks for ${damage} damage!`;
      } else {
        setPlayerHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!`;
      }
    } else if (action === 'special') {
      damage = Math.floor(Math.random() * 30) + 20;
      if (currentTurn === 'player') {
        setOpponentHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${playerTeddyData.name} uses ${playerTeddyData.special_move} for ${damage} damage!`;
      } else {
        setPlayerHealth((prev) => Math.max(0, prev - damage));
        logMessage = `${opponentTeddyData.name} uses ${opponentTeddyData.special_move} for ${damage} damage!`;
      }
    }

    setBattleLog((prev) => [...prev, logMessage]);
    setShowEffects(true);
    setTimeout(() => setShowEffects(false), 1000);
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');

    if (currentTurn === 'opponent') {
      setTimeout(() => {
        const aiAction = Math.random() > 0.3 ? 'attack' : 'special';
        performAction(aiAction);
      }, 1500);
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
          </div>
        )}
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