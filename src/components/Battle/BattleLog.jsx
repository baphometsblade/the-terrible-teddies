import React from 'react';
import { motion } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";

const BattleLog = ({ log }) => {
  return (
    <ScrollArea className="h-40 w-full rounded-md border p-4">
      <h3 className="text-lg font-semibold mb-2">Battle Log</h3>
      {log.map((entry, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="mb-2 text-sm"
        >
          {entry}
        </motion.div>
      ))}
    </ScrollArea>
  );
};

export default BattleLog;