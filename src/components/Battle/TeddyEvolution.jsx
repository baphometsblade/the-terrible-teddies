import React from 'react';
import { motion } from 'framer-motion';

const TeddyEvolution = ({ teddy, isEvolved }) => {
  return (
    <motion.div
      className="teddy-evolution"
      initial={{ scale: 1 }}
      animate={{ scale: isEvolved ? 1.2 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <img
        src={isEvolved ? teddy.evolvedImageUrl : teddy.imageUrl}
        alt={`${teddy.name} ${isEvolved ? '(Evolved)' : ''}`}
        className="w-32 h-32 object-cover rounded-full mx-auto"
      />
      <p className="text-center mt-2 font-bold">
        {teddy.name} {isEvolved && <span className="text-purple-500">(Evolved)</span>}
      </p>
    </motion.div>
  );
};

export default TeddyEvolution;