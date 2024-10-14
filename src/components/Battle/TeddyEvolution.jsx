import React from 'react';
import { motion } from 'framer-motion';
import { ImageOff } from 'lucide-react';

const TeddyEvolution = ({ teddy, isEvolved }) => {
  const imageUrl = isEvolved ? teddy.evolvedImageUrl : teddy.imageUrl;

  return (
    <motion.div
      className="teddy-evolution relative"
      initial={{ scale: 1 }}
      animate={{ scale: isEvolved ? 1.2 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-32 h-32 mx-auto overflow-hidden rounded-full border-4 border-yellow-400 shadow-lg bg-gray-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${teddy.name} ${isEvolved ? '(Evolved)' : ''}`}
            className="absolute inset-0 w-full h-full object-cover transform hover:scale-110 transition-transform duration-300 ease-in-out"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://via.placeholder.com/150x150?text=No+Image';
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageOff className="w-8 h-8 text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-50"></div>
      </div>
      <p className="text-center mt-2 font-bold text-lg">
        {teddy.name} {isEvolved && <span className="text-purple-500">(Evolved)</span>}
      </p>
    </motion.div>
  );
};

export default TeddyEvolution;