import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";

const BattleLog = ({ battleLog }) => {
  return (
    <ScrollArea className="h-40 w-full border rounded-md p-4">
      <AnimatePresence>
        {battleLog.map((log, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="mb-2"
          >
            {log}
          </motion.div>
        ))}
      </AnimatePresence>
    </ScrollArea>
  );
};

export default BattleLog;