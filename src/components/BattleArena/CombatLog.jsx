import React from 'react';
import { motion } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";

const CombatLog = ({ combatEvents }) => {
  return (
    <motion.div
      className="combat-log bg-white p-4 rounded-lg shadow-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-2">Combat Log</h3>
      <ScrollArea className="h-40">
        {combatEvents.map((event, index) => (
          <motion.div
            key={index}
            className="mb-1 text-sm"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {event}
          </motion.div>
        ))}
      </ScrollArea>
    </motion.div>
  );
};

export default CombatLog;