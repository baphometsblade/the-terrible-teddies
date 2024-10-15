import React from 'react';
import { Button } from "@/components/ui/button";
import { Sword, ShoppingBag, Zap, Gift, Award, Calendar } from 'lucide-react';

const GameMenu = ({ startBattle, setGameState, selectedTeddy }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-8">
      <Button onClick={startBattle} disabled={!selectedTeddy}>
        <Sword className="mr-2 h-4 w-4" /> Start Battle
      </Button>
      <Button onClick={() => setGameState('shop')}>
        <ShoppingBag className="mr-2 h-4 w-4" /> Shop
      </Button>
      <Button onClick={() => setGameState('evolution')} disabled={!selectedTeddy || selectedTeddy.experience < selectedTeddy.level * 100}>
        <Zap className="mr-2 h-4 w-4" /> Evolve
      </Button>
      <Button onClick={() => setGameState('powerUps')}>
        <Gift className="mr-2 h-4 w-4" /> Power-Ups
      </Button>
      <Button onClick={() => setGameState('achievements')}>
        <Award className="mr-2 h-4 w-4" /> Achievements
      </Button>
      <Button onClick={() => setGameState('seasonalEvent')}>
        <Calendar className="mr-2 h-4 w-4" /> Seasonal Event
      </Button>
    </div>
  );
};

export default GameMenu;