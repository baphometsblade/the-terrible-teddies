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
    console.log('useGameState effect', { 
      playerTeddies: playerTeddies ? playerTeddies.length : 'undefined', 
      selectedTeddy: selectedTeddy ? selectedTeddy.id : 'none'
    });
    if (playerTeddies && playerTeddies.length > 0 && !selectedTeddy) {
      console.log('Setting initial selected teddy');
      setSelectedTeddy(playerTeddies[0]);
    }
  }, [playerTeddies, selectedTeddy]);

  const startBattle = () => {
    if (!selectedTeddy) {
      console.log('No teddy selected for battle');
      toast({
        title: "No Teddy Selected",
        description: "Please select a teddy before starting a battle.",
        variant: "destructive",
      });
      return;
    }
    console.log('Starting battle with teddy:', selectedTeddy.id);
    setGameState('battle');
    toast({
      title: "Battle Started",
      description: `${selectedTeddy.name} is ready to fight!`,
      variant: "success",
    });
  };

  const handleBattleEnd = (result, updatedTeddy, experience) => {
    console.log('Battle ended', { result, updatedTeddyId: updatedTeddy?.id, experience });
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