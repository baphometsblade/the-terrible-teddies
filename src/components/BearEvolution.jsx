import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';

const BearEvolution = ({ teddy, onEvolve }) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const { toast } = useToast();

  const handleEvolve = () => {
    setIsEvolving(true);
    // Simulate evolution process
    setTimeout(() => {
      const evolvedTeddy = {
        ...teddy,
        attack: teddy.attack + 2,
        defense: teddy.defense + 2,
        level: (teddy.level || 1) + 1,
      };
      onEvolve(evolvedTeddy);
      toast({
        title: "Evolution Complete",
        description: `${teddy.name} has evolved to level ${evolvedTeddy.level}!`,
        variant: "success",
      });
      setIsEvolving(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center">
      <TeddyCard teddy={teddy} />
      <Button 
        onClick={handleEvolve} 
        disabled={isEvolving || (teddy.level && teddy.level >= 3)}
        className="mt-4"
      >
        {isEvolving ? "Evolving..." : "Evolve"}
      </Button>
    </div>
  );
};

export default BearEvolution;