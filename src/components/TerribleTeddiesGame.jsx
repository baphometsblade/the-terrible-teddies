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

const TerribleTeddiesGame = () => {
  const [gameState, setGameState] = useState('menu');
  const [playerTeddies, setPlayerTeddies] = useState([]);
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [battleStats, setBattleStats] = useState(null);
  const { toast } = useToast();

  const { data: fetchedTeddies, isLoading, error } = useQuery({
    queryKey: ['playerTeddies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*, terrible_teddies(*)')
        .eq('player_id', (await supabase.auth.getUser()).data.user.id);
      if (error) throw error;
      return data.map(item => item.terrible_teddies);
    },
  });

  useEffect(() => {
    if (fetchedTeddies) {
      setPlayerTeddies(fetchedTeddies);
      if (fetchedTeddies.length > 0 && !selectedTeddy) {
        setSelectedTeddy(fetchedTeddies[0]);
      }
    }
  }, [fetchedTeddies]);

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
      default:
        return (
          <div className="flex flex-col space-y-4">
            <h2 className="text-2xl font-bold">Your Teddies</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {playerTeddies.map(teddy => (
                <div
                  key={teddy.id}
                  onClick={() => setSelectedTeddy(teddy)}
                  className={`cursor-pointer ${selectedTeddy?.id === teddy.id ? 'border-4 border-blue-500' : ''}`}
                >
                  <TeddyCard teddy={teddy} />
                </div>
              ))}
            </div>
            <div className="flex space-x-4">
              <Button onClick={startBattle}>Start Battle</Button>
              <Button onClick={() => setGameState('shop')}>Visit Shop</Button>
              <Button onClick={() => setGameState('deckBuilder')}>Deck Builder</Button>
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
      {renderGameContent()}
      {gameState !== 'menu' && gameState !== 'battleResults' && (
        <Button onClick={() => setGameState('menu')} className="mt-4">
          Back to Menu
        </Button>
      )}
    </div>
  );
};

export default TerribleTeddiesGame;