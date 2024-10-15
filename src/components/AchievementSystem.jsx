import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const AchievementSystem = ({ achievements, setAchievements, onClose }) => {
  const allAchievements = [
    { id: 1, name: "Battle Novice", description: "Win 5 battles", requirement: 5, type: "battles_won" },
    { id: 2, name: "Evolution Master", description: "Evolve a teddy 3 times", requirement: 3, type: "evolutions" },
    { id: 3, name: "Collector", description: "Collect 10 unique teddies", requirement: 10, type: "unique_teddies" },
    { id: 4, name: "Power Player", description: "Use 20 power-ups", requirement: 20, type: "power_ups_used" },
  ];

  const getProgress = (achievement) => {
    const userAchievement = achievements.find(a => a.id === achievement.id);
    return userAchievement ? userAchievement.progress : 0;
  };

  return (
    <div className="achievement-system">
      <h2 className="text-2xl font-bold mb-4">Achievements</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {allAchievements.map((achievement) => (
          <Card key={achievement.id}>
            <CardHeader>
              <CardTitle>{achievement.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{achievement.description}</p>
              <Progress 
                value={(getProgress(achievement) / achievement.requirement) * 100} 
                className="mt-2"
              />
              <p className="mt-2">Progress: {getProgress(achievement)} / {achievement.requirement}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={onClose}>Close</Button>
    </div>
  );
};

export default AchievementSystem;