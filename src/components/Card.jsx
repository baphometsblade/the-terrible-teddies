import React from 'react';
import { motion } from 'framer-motion';

export const Card = ({ teddy, faceDown, onClick, disabled }) => {
  return (
    <motion.div
      className={`card w-40 h-56 rounded-lg shadow-xl overflow-hidden cursor-pointer ${disabled ? 'opacity-50' : ''}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={!disabled && !faceDown ? onClick : undefined}
    >
      {faceDown ? (
        <div className="w-full h-full bg-purple-500 flex items-center justify-center">
          <span className="text-white text-2xl font-bold">?</span>
        </div>
      ) : (
        <div className="w-full h-full bg-white p-2 flex flex-col">
          <img src={teddy.url} alt={teddy.name} className="w-full h-24 object-cover rounded-t-lg" />
          <div className="mt-2">
            <h3 className="text-sm font-bold">{teddy.name}</h3>
            <p className="text-xs">Attack: {teddy.energy_cost}</p>
            <p className="text-xs">Effect: {teddy.effect}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};