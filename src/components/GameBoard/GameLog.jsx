import React from 'react';
import { motion } from 'framer-motion';

const getLogEntryColor = (entry) => {
  if (entry.action.includes('played')) return 'text-green-600';
  if (entry.action.includes('attacked')) return 'text-red-600';
  if (entry.action.includes('defended')) return 'text-blue-600';
  if (entry.action.includes('special move')) return 'text-yellow-600';
  return 'text-purple-700';
};

export const GameLog = ({ log }) => (
  <div className="w-1/2 pl-2">
    <div className="game-log bg-gradient-to-r from-indigo-100 to-blue-100 p-4 rounded-lg shadow-md h-64 overflow-y-auto">
      <h3 className="text-lg font-semibold text-purple-800 mb-2">Game Log</h3>
      <ul className="space-y-2">
        {log.map((entry, index) => (
          <motion.li
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={`text-sm ${getLogEntryColor(entry)}`}
          >
            <span className="font-semibold">{entry.player}:</span> {entry.action}
          </motion.li>
        ))}
      </ul>
    </div>
  </div>
);
