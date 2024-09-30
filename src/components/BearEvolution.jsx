import React, { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';
import { Button } from "@/components/ui/button";

const BearEvolution = ({ teddy, onEvolve }) => {
  const [isEvolving, setIsEvolving] = useState(false);
  const { toast } = useToast();

  const handleEvolve = () => {
    setIsEvolving(true);
    // Simulating an API call for evolution
    setTimeout(() => {
      const evolvedTeddy = {
        ...teddy,
        attack: teddy.attack + 2,
        defense: teddy.defense + 2,
        level: (teddy.level || 1) + 1,
      };
      onEvolve(evolvedTeddy);
      setIsEvolving(false);
      toast({
        title: "Evolution Complete!",
        description: `${teddy.name} has evolved and become stronger!`,
        variant: "success",
      });
    }, 2000);
  };

  return (
    <div className="bear-evolution">
      <h2 className="text-2xl font-bold mb-4">Bear Evolution</h2>
      <TeddyCard teddy={teddy} />
      <Button 
        onClick={handleEvolve} 
        disabled={isEvolving}
        className="mt-4"
      >
        {isEvolving ? 'Evolving...' : 'Evolve Bear'}
      </Button>
    </div>
  );
};

export default BearEvolution;