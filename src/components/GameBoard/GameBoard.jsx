import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import PlayerArea from './PlayerArea';
import OpponentArea from './OpponentArea';
import ActionArea from './ActionArea';
import GameStatus from './GameStatus';
import { calculateDamage } from '../../utils/battleSystem';
import AIOpponent from '../../utils/AIOpponent';

const GameBoard = () => {
  const [gameState, setGameState] = useState('drawing');
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [isSinglePlayer, setIsSinglePlayer] = useState(true);
  const { toast } = useToast();

  const { data: playerDeck, isLoading, error } = useQuery({
    queryKey: ['playerDeck'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_teddies')
        .select('*')
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (playerDeck) {
      if (isSinglePlayer) {
        setOpponentTeddy(AIOpponent.generateTeddy());
      } else {
        // In multiplayer, we'd fetch the opponent's hand from the server
        setOpponentTeddy(playerDeck[Math.floor(Math.random() * playerDeck.length)]);
      }
    }
  }, [playerDeck, isSinglePlayer]);

  const performAction = (action) => {
    if (action === 'attack') {
      const damage = calculateDamage(selectedTeddy, opponentTeddy);
      setOpponentHealth(prev => Math.max(0, prev - damage));
    } else if (action === 'defend') {
      setSelectedTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
    } else if (action === 'special' && playerEnergy >= 2) {
      setPlayerEnergy(prev => prev - 2);
      // Implement special move logic here
    }

    if (isSinglePlayer) {
      const aiAction = AIOpponent.chooseAction(opponentTeddy, selectedTeddy, opponentEnergy);
      if (aiAction === 'attack') {
        const damage = calculateDamage(opponentTeddy, selectedTeddy);
        setPlayerHealth(prev => Math.max(0, prev - damage));
      } else if (aiAction === 'defend') {
        setOpponentTeddy(prev => ({ ...prev, defense: prev.defense + 2 }));
      } else if (aiAction === 'special' && opponentEnergy >= 2) {
        setOpponentEnergy(prev => prev - 2);
        // Implement AI special move logic here
      }
    } else {
      // In multiplayer, we'd send the action to the server and wait for the opponent's response
    }

    checkGameOver();
  };

  const checkGameOver = () => {
    if (playerHealth <= 0) {
      setGameState('gameOver');
      toast({
        title: "Game Over",
        description: "You lost the battle!",
        variant: "destructive",
      });
    } else if (opponentHealth <= 0) {
      setGameState('gameOver');
      toast({
        title: "Victory!",
        description: "You won the battle!",
        variant: "success",
      });
    }
  };

  if (isLoading) return <div>Loading game...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Battle Arena</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayerArea 
          selectedTeddy={selectedTeddy}
          playerHealth={playerHealth}
          playerEnergy={playerEnergy}
        />
        <OpponentArea 
          opponentTeddy={opponentTeddy}
          opponentHealth={opponentHealth}
          opponentEnergy={opponentEnergy}
        />
      </div>
      <ActionArea 
        gameState={gameState}
        playerDeck={playerDeck}
        selectedTeddy={selectedTeddy}
        setSelectedTeddy={setSelectedTeddy}
        performAction={performAction}
        playerEnergy={playerEnergy}
      />
      <GameStatus gameState={gameState} />
    </div>
  );
};

export default GameBoard;