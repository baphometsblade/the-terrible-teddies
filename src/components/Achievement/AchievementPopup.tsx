import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";

interface AchievementPopupProps {
  achievement: {
    id: string;
    title: string;
    description: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  };
  onClose: () => void;
}

const AchievementPopup: React.FC<AchievementPopupProps> = ({ achievement, onClose }) => {
  const rarityColors = {
    common: 'from-gray-500/80 to-gray-600/80',
    rare: 'from-blue-500/80 to-blue-600/80',
    epic: 'from-purple-500/80 to-purple-600/80',
    legendary: 'from-yellow-500/80 to-yellow-600/80'
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Card className={`bg-gradient-to-r ${rarityColors[achievement.rarity]} text-white`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6" />
              <div>
                <h3 className="font-bold text-lg">{achievement.title}</h3>
                <p className="text-sm opacity-90">{achievement.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default AchievementPopup;