import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const PowerUpSystem = ({ powerUps, setPowerUps, onClose }) => {
  const { toast } = useToast();

  const availablePowerUps = [
    { id: 1, name: "Attack Boost", description: "Increase attack by 20% for the next battle", cost: 100 },
    { id: 2, name: "Defense Shield", description: "Increase defense by 20% for the next battle", cost: 100 },
    { id: 3, name: "Energy Surge", description: "Start the next battle with 1 extra energy", cost: 150 },
    { id: 4, name: "Health Potion", description: "Restore 30% of max health during battle", cost: 200 },
  ];

  const purchasePowerUp = (powerUp) => {
    // In a real implementation, we would check the player's currency and deduct the cost
    setPowerUps([...powerUps, powerUp]);
    toast({
      title: "Power-Up Purchased",
      description: `You've acquired the ${powerUp.name} power-up!`,
      variant: "success",
    });
  };

  return (
    <div className="power-up-system">
      <h2 className="text-2xl font-bold mb-4">Power-Up Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {availablePowerUps.map((powerUp) => (
          <Card key={powerUp.id}>
            <CardHeader>
              <CardTitle>{powerUp.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{powerUp.description}</p>
              <p className="mt-2">Cost: {powerUp.cost} coins</p>
              <Button 
                onClick={() => purchasePowerUp(powerUp)} 
                className="mt-2 w-full"
              >
                Purchase
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={onClose}>Close</Button>
    </div>
  );
};

export default PowerUpSystem;