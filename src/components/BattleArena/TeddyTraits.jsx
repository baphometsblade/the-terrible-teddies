import React from 'react';
import { motion } from 'framer-motion';

const TeddyTraits = ({ teddy }) => {
  return (
    <motion.div
      className="teddy-traits bg-gray-100 p-4 rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-2">Teddy Traits</h2>
      <ul>
        {teddy.traits.map((trait, index) => (
          <motion.li
            key={index}
            className="mb-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <span className="font-semibold">{trait.name}:</span> {trait.description}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
};

export default TeddyTraits;