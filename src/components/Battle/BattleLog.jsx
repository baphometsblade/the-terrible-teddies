import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BattleLog = ({ battleLog }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Battle Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc pl-5">
          {battleLog.slice(-5).map((log, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {log}
            </motion.li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default BattleLog;