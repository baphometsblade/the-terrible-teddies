import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from 'framer-motion';
import Battle from './Battle';
import Shop from './Shop';
import Evolution from './Evolution';
import PowerUpSystem from './PowerUpSystem';
import AchievementSystem from './AchievementSystem';
import SeasonalEvent from './SeasonalEvent';
import ErrorBoundary from './ErrorBoundary';
import GameMenu from './GameMenu';
import TeddyCollection from './TeddyCollection';

const TerribleTeddiesGame = () => {
  const { toast } = useToast();
  const [gameState, setGameState] = useState('menu');
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [powerUps, setPowerUps] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const { data: playerTeddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(pt => pt.terrible_teddies);
    },
  });

  useEffect(() => {
    if (error) {
      console.error('Error loading teddies:', error);
      toast({
        title: "Error loading teddies",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

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
    const availableOpponents = playerTeddies.filter(t => t.id !== selectedTeddy.id);
    const randomOpponent = availableOpponents[Math.floor(Math.random() * availableOpponents.length)];
    setOpponent(randomOpponent);
    setGameState('battle');
    toast({
      title: "Battle Started",
      description: `${selectedTeddy.name} is ready to fight against ${randomOpponent.name}!`,
      variant: "success",
    });
  };

  const renderGameContent = () => {
    switch (gameState) {
      case 'battle':
        return (
          <Battle
            playerTeddy={selectedTeddy}
            opponentTeddy={opponent}
            powerUps={powerUps}
            onBattleEnd={(result, updatedTeddy, experience) => {
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
            }}
          />
        );
      case 'shop':
        return <Shop onExit={() => setGameState('menu')} />;
      case 'evolution':
        return <Evolution teddy={selectedTeddy} onClose={() => setGameState('menu')} />;
      case 'powerUps':
        return <PowerUpSystem powerUps={powerUps} setPowerUps={setPowerUps} onClose={() => setGameState('menu')} />;
      case 'achievements':
        return <AchievementSystem achievements={achievements} setAchievements={setAchievements} onClose={() => setGameState('menu')} />;
      case 'seasonalEvent':
        return <SeasonalEvent onClose={() => setGameState('menu')} />;
      default:
        return (
          <Tabs defaultValue="collection" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="collection">Collection</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>
            <TabsContent value="collection">
              <h2 className="text-2xl font-bold mb-4">Your Teddies</h2>
              <TeddyCollection
                playerTeddies={playerTeddies}
                selectedTeddy={selectedTeddy}
                setSelectedTeddy={setSelectedTeddy}
              />
            </TabsContent>
            <TabsContent value="stats">
              <h2 className="text-2xl font-bold mb-4">Your Stats</h2>
              <p>Player statistics to be implemented.</p>
            </TabsContent>
            <TabsContent value="events">
              <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
              <p>Event calendar to be implemented.</p>
            </TabsContent>
          </Tabs>
        );
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
            {renderGameContent()}
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