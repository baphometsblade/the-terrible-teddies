import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary';
import GameMenu from './GameMenu';
import GameContent from './GameContent';
import { usePlayerTeddies } from '../hooks/usePlayerTeddies';

const TerribleTeddiesGame = () => {
  const { toast } = useToast();
  const [gameState, setGameState] = useState('menu');
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [powerUps, setPowerUps] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const { data: playerTeddies, isLoading, error } = usePlayerTeddies();

  useEffect(() => {
    if (playerTeddies && playerTeddies.length > 0) {
      setSelectedTeddy(playerTeddies[0]);
    }
  }, [playerTeddies]);

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
    }
  };

  if (isLoading) return <div>Loading your teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
        <AnimatePresence mode="wait">
          <motion.div
            key={gameState}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <GameContent
              gameState={gameState}
              playerTeddies={playerTeddies}
              selectedTeddy={selectedTeddy}
              setSelectedTeddy={setSelectedTeddy}
              onBattleEnd={handleBattleEnd}
              powerUps={powerUps}
              setPowerUps={setPowerUps}
              achievements={achievements}
              setAchievements={setAchievements}
            />
          </motion.div>
        </AnimatePresence>
        <GameMenu
          startBattle={startBattle}
          setGameState={setGameState}
          selectedTeddy={selectedTeddy}
        />
      </div>
    </ErrorBoundary>
  );
};

export default TerribleTeddiesGame;