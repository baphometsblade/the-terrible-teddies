import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BattleEffects = ({ effects }) => {
  return (
    <div className="battle-effects mt-4">
      <h3 className="text-lg font-semibold mb-2">Active Effects</h3>
      <AnimatePresence>
        {effects.map((effect, index) => (
          <motion.div
            key={effect.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-2 rounded-md shadow-md mb-2"
          >
            <p className="font-medium">{effect.name}</p>
            <p className="text-sm text-gray-600">{effect.description}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default BattleEffects;