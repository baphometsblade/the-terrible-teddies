import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";

const BattleSummary = ({ winner, playerTeddy, opponentTeddy, battleState, onClose }) => {
  const playerDamageDealt = battleState.initialOpponentHealth - battleState.opponentHealth;
  const opponentDamageDealt = battleState.initialPlayerHealth - battleState.playerHealth;

  return (
    <motion.div
      className="battle-summary fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full"
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h2 className="text-2xl font-bold mb-4">Battle Summary</h2>
        <p className="text-xl mb-4">{winner === 'player' ? playerTeddy.name : opponentTeddy.name} wins!</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="font-semibold">{playerTeddy.name}</h3>
            <p>Damage Dealt: {playerDamageDealt}</p>
            <p>Health Remaining: {battleState.playerHealth}</p>
          </div>
          <div>
            <h3 className="font-semibold">{opponentTeddy.name}</h3>
            <p>Damage Dealt: {opponentDamageDealt}</p>
            <p>Health Remaining: {battleState.opponentHealth}</p>
          </div>
        </div>
        <p className="mb-4">Rounds: {battleState.roundCount}</p>
        <Button onClick={onClose} className="w-full">Continue</Button>
      </motion.div>
    </motion.div>
  );
};

export default BattleSummary;