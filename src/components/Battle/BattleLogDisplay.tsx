import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BattleLogDisplayProps {
  logs: string[];
}

const BattleLogDisplay = ({ logs }: BattleLogDisplayProps) => {
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Battle Log</CardTitle>
      </CardHeader>
      <CardContent className="h-48 overflow-y-auto">
        <AnimatePresence>
          {logs.map((log, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-gray-600 mb-2"
            >
              {log}
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default BattleLogDisplay;