import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RandomEventDisplay = ({ events }) => {
  return (
    <div className="random-events mt-4">
      <h3 className="text-lg font-semibold mb-2">Random Events</h3>
      <AnimatePresence>
        {events.map((event, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="bg-purple-100 p-2 rounded-md mb-2"
          >
            <p className="font-medium">{event.name}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default RandomEventDisplay;