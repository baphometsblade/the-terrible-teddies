import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Swords } from 'lucide-react';

interface ComboDisplayProps {
  comboCount: number;
  maxCombo: number;
  currentCombo: string[];
}

const ComboDisplay: React.FC<ComboDisplayProps> = ({ comboCount, maxCombo, currentCombo }) => {
  const comboProgress = (comboCount / maxCombo) * 100;

  return (
    <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold">Combo Chain</h3>
        </div>
        <Progress value={comboProgress} className="mb-2" />
        <div className="flex gap-2">
          <AnimatePresence>
            {currentCombo.map((move, index) => (
              <motion.div
                key={`${move}-${index}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="bg-purple-500/20 rounded-lg p-2 text-sm font-medium"
              >
                {move}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComboDisplay;