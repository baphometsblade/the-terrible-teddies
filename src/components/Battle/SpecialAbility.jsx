import React from 'react';
import { motion } from 'framer-motion';

const SpecialAbility = ({ ability, onUse, isDisabled }) => {
  return (
    <motion.button
      className={`special-ability px-4 py-2 rounded-full text-white font-bold ${
        isDisabled ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onUse}
      disabled={isDisabled}
    >
      {ability.name}
    </motion.button>
  );
};

export default SpecialAbility;