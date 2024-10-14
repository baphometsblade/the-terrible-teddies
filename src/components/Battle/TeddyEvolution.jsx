import React from 'react';
import { motion } from 'framer-motion';

const TeddyEvolution = ({ teddy, isEvolved }) => {
  return (
    <motion.div
      className="teddy-evolution relative"
      initial={{ scale: 1 }}
      animate={{ scale: isEvolved ? 1.2 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-32 h-32 mx-auto overflow-hidden rounded-full border-4 border-yellow-400 shadow-lg">
        <img
          src={isEvolved ? teddy.evolvedImageUrl : teddy.imageUrl}
          alt={`${teddy.name} ${isEvolved ? '(Evolved)' : ''}`}
          className="absolute inset-0 w-full h-full object-cover transform hover:scale-110 transition-transform duration-300 ease-in-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-50"></div>
      </div>
      <p className="text-center mt-2 font-bold text-lg">
        {teddy.name} {isEvolved && <span className="text-purple-500">(Evolved)</span>}
      </p>
    </motion.div>
  );
};

export default TeddyEvolution;