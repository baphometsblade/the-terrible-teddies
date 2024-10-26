import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Lock, CheckCircle } from 'lucide-react';
import { Achievement } from '../../types/types';

interface AchievementListProps {
  achievements: Achievement[];
  unlockedAchievements: string[];
}

const AchievementList: React.FC<AchievementListProps> = ({ achievements, unlockedAchievements }) => {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'bg-gray-100 border-gray-300';
      case 'rare':
        return 'bg-blue-100 border-blue-300';
      case 'epic':
        return 'bg-purple-100 border-purple-300';
      case 'legendary':
        return 'bg-yellow-100 border-yellow-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {achievements.map((achievement) => {
        const isUnlocked = unlockedAchievements.includes(achievement.id);
        
        return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`${getRarityColor(achievement.rarity)} relative overflow-hidden`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isUnlocked ? (
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-400" />
                  )}
                  {achievement.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={isUnlocked ? 100 : 0} 
                    className="flex-grow"
                  />
                  {isUnlocked && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};

export default AchievementList;