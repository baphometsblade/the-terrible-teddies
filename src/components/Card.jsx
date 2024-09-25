import React from 'react';
import { motion } from 'framer-motion';
import { Card as UICard, CardContent } from "@/components/ui/card";

export const Card = ({ teddy, onClick, isSelected, canPlay, faceDown }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => !faceDown && canPlay && onClick(teddy)}
    >
      <UICard className={`w-40 h-56 ${isSelected ? 'ring-2 ring-blue-500' : ''} ${faceDown ? 'bg-purple-500' : 'bg-white'}`}>
        <CardContent className="p-2">
          {faceDown ? (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white text-4xl">?</span>
            </div>
          ) : (
            <>
              <img src={teddy.url} alt={teddy.name} className="w-full h-24 object-cover mb-2 rounded" />
              <h3 className="text-sm font-bold mb-1">{teddy.name}</h3>
              <p className="text-xs mb-1">Attack: {teddy.attack}</p>
              <p className="text-xs mb-1">Defense: {teddy.defense}</p>
              <p className="text-xs italic">{teddy.special_move}</p>
            </>
          )}
        </CardContent>
      </UICard>
    </motion.div>
  );
};
