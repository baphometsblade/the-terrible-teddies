import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import TeddyCard from './TeddyCard';
import PlayerHand from './PlayerHand';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { calculateDamage } from '../utils/battleSystem';
import AIOpponent from './AIOpponent';

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [selectedTeddy, setSelectedTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [gameState, setGameState] = useState('drawing'); // 'drawing', 'battling', 'gameOver'
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
      setPlayerHand(playerDeck);
      if (isSinglePlayer) {
        setOpponentHand(AIOpponent.generateHand(5));
      } else {
        // In multiplayer, we'd fetch the opponent's hand from the server
        setOpponentHand([...playerDeck].sort(() => Math.random() - 0.5));
      }
    }
  }, [playerDeck, isSinglePlayer]);

  const selectTeddy = (teddy) => {
    setSelectedTeddy(teddy);
  };

  const startBattle = () => {
    if (!selectedTeddy) {
      toast({
        title: "Select a teddy",
        description: "You must select a teddy to battle",
        variant: "destructive",
      });
      return;
    }
    setOpponentTeddy(opponentHand[Math.floor(Math.random() * opponentHand.length)]);
    setGameState('battling');
  };

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
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Teddy</h2>
          {selectedTeddy && (
            <TeddyCard teddy={selectedTeddy} />
          )}
          <p>Health: {playerHealth}</p>
          <p>Energy: {playerEnergy}</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Opponent's Teddy</h2>
          {opponentTeddy && (
            <TeddyCard teddy={opponentTeddy} />
          )}
          <p>Health: {opponentHealth}</p>
          <p>Energy: {opponentEnergy}</p>
        </div>
      </div>
      {gameState === 'drawing' && (
        <div>
          <h2 className="text-2xl font-bold mb-2">Your Hand</h2>
          <PlayerHand
            hand={playerHand}
            onSelectTeddy={selectTeddy}
            selectedTeddy={selectedTeddy}
          />
          <Button onClick={startBattle} className="mt-4" disabled={!selectedTeddy}>Start Battle</Button>
        </div>
      )}
      {gameState === 'battling' && (
        <div className="mt-4">
          <h2 className="text-2xl font-bold mb-2">Battle Actions</h2>
          <div className="flex space-x-2">
            <Button onClick={() => performAction('attack')}>Attack</Button>
            <Button onClick={() => performAction('defend')}>Defend</Button>
            <Button onClick={() => performAction('special')} disabled={playerEnergy < 2}>Special Move (2 Energy)</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;