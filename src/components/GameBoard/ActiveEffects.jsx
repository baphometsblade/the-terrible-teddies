import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export const ActiveEffects = ({ effects }) => {
  return (
    <div className="active-effects mt-4">
      <h3 className="text-lg font-semibold text-purple-800 mb-2">Active Effects</h3>
      <div className="flex flex-wrap gap-2">
        {effects.map((effect, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              {effect.name}
            </Badge>
          </motion.div>
        ))}
      </div>
    </div>
  );
};