import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const SeasonalEvent = ({ onClose }) => {
  const { toast } = useToast();
  const [eventProgress, setEventProgress] = useState(0);

  const currentEvent = {
    name: "Summer Beach Bash",
    description: "Collect beach-themed teddies and win exclusive rewards!",
    rewards: [
      { name: "Surfer Teddy", requirement: 100 },
      { name: "Beach Ball Power-Up", requirement: 250 },
      { name: "Tropical Paradise Background", requirement: 500 },
    ],
  };

  const participateInEvent = () => {
    // In a real implementation, this would involve some game logic
    const pointsEarned = Math.floor(Math.random() * 50) + 10;
    setEventProgress(prev => prev + pointsEarned);
    toast({
      title: "Event Progress",
      description: `You earned ${pointsEarned} event points!`,
      variant: "success",
    });
  };

  return (
    <div className="seasonal-event">
      <h2 className="text-2xl font-bold mb-4">{currentEvent.name}</h2>
      <p className="mb-4">{currentEvent.description}</p>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Event Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Total Points: {eventProgress}</p>
          <Button onClick={participateInEvent} className="mt-2">Participate</Button>
        </CardContent>
      </Card>
      <h3 className="text-xl font-bold mb-2">Rewards</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {currentEvent.rewards.map((reward, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle>{reward.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Required Points: {reward.requirement}</p>
              <p>Status: {eventProgress >= reward.requirement ? 'Unlocked' : 'Locked'}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={onClose}>Close</Button>
    </div>
  );
};

export default SeasonalEvent;