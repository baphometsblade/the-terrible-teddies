import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Zap, Shield, Swords } from 'lucide-react';

interface ComboDisplayProps {
  activeCombo: string[];
  comboProgress: number;
  possibleCombos: Record<string, { name: string; description: string; icon: string }>;
}

const ComboDisplay: React.FC<ComboDisplayProps> = ({ activeCombo, comboProgress, possibleCombos }) => {
  const getComboIcon = (icon: string) => {
    switch (icon) {
      case 'flame': return <Flame className="w-6 h-6 text-orange-500" />;
      case 'zap': return <Zap className="w-6 h-6 text-yellow-500" />;
      case 'shield': return <Shield className="w-6 h-6 text-blue-500" />;
      default: return <Swords className="w-6 h-6 text-red-500" />;
    }
  };

  return (
    <div className="combo-display">
      <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Active Combo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <AnimatePresence>
              {activeCombo.map((move, index) => (
                <motion.div
                  key={`${move}-${index}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="p-2 bg-gray-800 rounded-lg"
                >
                  {getComboIcon(move)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <Progress value={comboProgress} className="h-2 bg-gray-700" />
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Available Combos:</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(possibleCombos).map(([key, combo]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 text-sm"
                >
                  {getComboIcon(combo.icon)}
                  <div>
                    <p className="font-medium">{combo.name}</p>
                    <p className="text-xs text-gray-400">{combo.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComboDisplay;