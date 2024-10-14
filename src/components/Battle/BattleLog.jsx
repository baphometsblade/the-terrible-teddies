import React from 'react';
import { motion } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

const BattleLog = ({ log }) => {
  return (
    <Card className="mt-4">
      <CardContent>
        <h3 className="text-lg font-semibold mb-2">Battle Log</h3>
        <ScrollArea className="h-40 w-full rounded-md">
          {log.map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="mb-2 text-sm border-b border-gray-200 pb-1"
            >
              {entry}
            </motion.div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BattleLog;