import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { usePlayerTeddies } from './usePlayerTeddies';

export const useGameState = () => {
  const { toast } = useToast();
  const [gameState, setGameState] = useState('menu');
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [powerUps, setPowerUps] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const { data: playerTeddies, isLoading, error, refetch } = usePlayerTeddies();

  useEffect(() => {
    if (playerTeddies && playerTeddies.length > 0 && !selectedTeddy) {
      setSelectedTeddy(playerTeddies[0]);
    }
  }, [playerTeddies, selectedTeddy]);

  const startBattle = () => {
    if (!selectedTeddy) {
      toast({
        title: "No Teddy Selected",
        description: "Please select a teddy before starting a battle.",
        variant: "destructive",
      });
      return;
    }
    setGameState('battle');
    toast({
      title: "Battle Started",
      description: `${selectedTeddy.name} is ready to fight!`,
      variant: "success",
    });
  };

  const handleBattleEnd = (result, updatedTeddy, experience) => {
    setGameState('menu');
    toast({
      title: result === 'win' ? "Victory!" : "Defeat",
      description: result === 'win' 
        ? `You won the battle! ${selectedTeddy.name} gained ${experience} XP.` 
        : "You lost the battle.",
      variant: result === 'win' ? "success" : "destructive",
    });
    if (result === 'win' && updatedTeddy) {
      setSelectedTeddy(updatedTeddy);
      refetch(); // Refetch player teddies to update the list
    }
  };

  return {
    gameState,
    setGameState,
    selectedTeddy,
    setSelectedTeddy,
    powerUps,
    setPowerUps,
    achievements,
    setAchievements,
    playerTeddies,
    isLoading,
    error,
    startBattle,
    handleBattleEnd
  };
};