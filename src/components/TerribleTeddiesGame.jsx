import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, ShoppingBag, Award, Zap, Calendar, Gift } from 'lucide-react';

const TerribleTeddiesGame = () => {
  const { toast } = useToast();
  const [gameState, setGameState] = useState('menu');
  const [selectedTeddy, setSelectedTeddy] = useState(null);

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
    setGameState('battle');
    // Here you would typically initiate the battle logic
    toast({
      title: "Battle Started",
      description: `${selectedTeddy.name} is ready to fight!`,
      variant: "success",
    });
  };

  const renderTeddyCard = (teddy) => (
    <Card key={teddy.id} className={`cursor-pointer ${selectedTeddy?.id === teddy.id ? 'border-4 border-blue-500' : ''}`}
         onClick={() => setSelectedTeddy(teddy)}>
      <CardHeader>
        <CardTitle>{teddy.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{teddy.description}</p>
        <div className="mt-2">
          <span className="mr-2">Attack: {teddy.attack}</span>
          <span>Defense: {teddy.defense}</span>
        </div>
      </CardContent>
    </Card>
  );

  const renderGameContent = () => {
    switch (gameState) {
      case 'battle':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
            <p>Battle functionality to be implemented.</p>
            <Button onClick={() => setGameState('menu')} className="mt-4">Back to Menu</Button>
          </div>
        );
      case 'shop':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Teddy Shop</h2>
            <p>Shop functionality to be implemented.</p>
            <Button onClick={() => setGameState('menu')} className="mt-4">Back to Menu</Button>
          </div>
        );
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {playerTeddies && playerTeddies.map(renderTeddyCard)}
              </div>
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
      <div className="flex justify-center space-x-4 mt-8">
        <Button onClick={startBattle} disabled={!selectedTeddy}>
          <Sword className="mr-2 h-4 w-4" /> Start Battle
        </Button>
        <Button onClick={() => setGameState('shop')}>
          <ShoppingBag className="mr-2 h-4 w-4" /> Shop
        </Button>
        <Button onClick={() => toast({ title: "Coming Soon", description: "This feature is not yet implemented." })}>
          <Award className="mr-2 h-4 w-4" /> Leaderboard
        </Button>
        <Button onClick={() => toast({ title: "Coming Soon", description: "This feature is not yet implemented." })}>
          <Zap className="mr-2 h-4 w-4" /> Evolve
        </Button>
        <Button onClick={() => toast({ title: "Coming Soon", description: "This feature is not yet implemented." })}>
          <Calendar className="mr-2 h-4 w-4" /> Daily Challenge
        </Button>
        <Button onClick={() => toast({ title: "Coming Soon", description: "This feature is not yet implemented." })}>
          <Gift className="mr-2 h-4 w-4" /> Seasonal Event
        </Button>
      </div>
    </div>
  );
};

export default TerribleTeddiesGame;