import React from 'react';
import { motion } from 'framer-motion';
import TeddyCard from '../TeddyCard';

const BattleField = ({ playerTeddy, opponentTeddy, playerHealth, opponentHealth, playerEnergy, opponentEnergy, currentTurn }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
        <motion.div
          animate={{ scale: currentTurn === 'player' ? 1.05 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <TeddyCard teddy={playerTeddy} />
        </motion.div>
        <p>Health: {playerHealth}/30</p>
        <p>Energy: {playerEnergy}/3</p>
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
        <motion.div
          animate={{ scale: currentTurn === 'opponent' ? 1.05 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <TeddyCard teddy={opponentTeddy} />
        </motion.div>
        <p>Health: {opponentHealth}/30</p>
        <p>Energy: {opponentEnergy}/3</p>
      </div>
    </div>
  );
};

export default BattleField;