import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from './TeddyCard';
import Battle from './Battle/Battle';
import Shop from './Shop';
import DeckBuilder from './DeckBuilder/DeckBuilder';
import BattleStats from './Battle/BattleStats';
import Evolution from './Evolution';
import DailyChallenge from './DailyChallenge';
import { motion, AnimatePresence } from 'framer-motion';

const TerribleTeddiesGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [battleStats, setBattleStats] = useState(null);
  const { toast } = useToast();

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
    setBattleStats(null);
  };

  const handleBattleEnd = (result, stats) => {
    setGameState('battleResults');
    setBattleStats(stats);
    toast({
      title: result === 'win' ? "Victory!" : "Defeat",
      description: result === 'win' ? "You won the battle!" : "You lost the battle.",
      variant: result === 'win' ? "success" : "destructive",
    });
  };

  const renderGameContent = () => {
    switch (gameState) {
      case 'battle':
        return (
          <Battle
            playerTeddy={selectedTeddy}
            opponentTeddy={playerTeddies[Math.floor(Math.random() * playerTeddies.length)]}
            onBattleEnd={handleBattleEnd}
          />
        );
      case 'battleResults':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Battle Results</h2>
            {battleStats && <BattleStats playerStats={battleStats.player} opponentStats={battleStats.opponent} />}
            <Button onClick={() => setGameState('menu')} className="mt-4">Back to Menu</Button>
          </div>
        );
      case 'shop':
        return <Shop />;
      case 'deckBuilder':
        return <DeckBuilder />;
      case 'evolution':
        return selectedTeddy && <Evolution teddy={selectedTeddy} />;
      case 'dailyChallenge':
        return <DailyChallenge />;
      default:
        return (
          <div className="flex flex-col space-y-4">
            <h2 className="text-2xl font-bold">Your Teddies</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {playerTeddies.map(teddy => (
                <motion.div
                  key={teddy.id}
                  onClick={() => setSelectedTeddy(teddy)}
                  className={`cursor-pointer ${selectedTeddy?.id === teddy.id ? 'border-4 border-blue-500' : ''}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <TeddyCard teddy={teddy} />
                </motion.div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button onClick={startBattle}>Start Battle</Button>
              <Button onClick={() => setGameState('shop')}>Visit Shop</Button>
              <Button onClick={() => setGameState('deckBuilder')}>Deck Builder</Button>
              <Button onClick={() => setGameState('evolution')}>Evolve Teddy</Button>
              <Button onClick={() => setGameState('dailyChallenge')}>Daily Challenge</Button>
            </div>
          </div>
        );
    }
  };

  if (isLoading) return <div>Loading your teddies...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Terrible Teddies</h1>
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
      {gameState !== 'menu' && gameState !== 'battleResults' && (
        <Button onClick={() => setGameState('menu')} className="mt-4">
          Back to Menu
        </Button>
      )}
    </div>
  );
};

export default TerribleTeddiesGame;