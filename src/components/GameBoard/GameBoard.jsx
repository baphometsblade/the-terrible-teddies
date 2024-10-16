import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddyCard from '../TeddyCard';
import { useToast } from "@/components/ui/use-toast";

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([
    { id: 1, name: "Teddy 1", attack: 2, defense: 2 },
    { id: 2, name: "Teddy 2", attack: 3, defense: 1 },
    { id: 3, name: "Teddy 3", attack: 1, defense: 3 },
    { id: 4, name: "Teddy 4", attack: 2, defense: 2 },
    { id: 5, name: "Teddy 5", attack: 3, defense: 2 },
  ]);
  const [playerField, setPlayerField] = useState([]);
  const [opponentField, setOpponentField] = useState([
    { id: 6, name: "Opponent 1", attack: 2, defense: 2 },
    { id: 7, name: "Opponent 2", attack: 2, defense: 2 },
  ]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [deck, setDeck] = useState([
    { id: 8, name: "Teddy 6", attack: 3, defense: 3 },
    { id: 9, name: "Teddy 7", attack: 4, defense: 2 },
    { id: 10, name: "Teddy 8", attack: 2, defense: 4 },
  ]);
  const { toast } = useToast();

  const playCard = (card) => {
    if (currentTurn === 'player' && playerField.length < 3) {
      setPlayerField([...playerField, card]);
      setPlayerHand(playerHand.filter(c => c.id !== card.id));
      toast({
        title: "Card Played",
        description: `You played ${card.name}`,
      });
    }
  };

  const attack = (attackingCard, targetCard) => {
    if (currentTurn === 'player') {
      const damage = Math.max(0, attackingCard.attack - targetCard.defense);
      setOpponentHealth(prevHealth => Math.max(0, prevHealth - damage));
      setOpponentField(opponentField.filter(c => c.id !== targetCard.id));
      toast({
        title: "Attack",
        description: `${attackingCard.name} dealt ${damage} damage to ${targetCard.name}`,
      });
    }
  };

  const drawCard = () => {
    if (deck.length > 0) {
      const drawnCard = deck[0];
      setPlayerHand([...playerHand, drawnCard]);
      setDeck(deck.slice(1));
      toast({
        title: "Card Drawn",
        description: `You drew ${drawnCard.name}`,
      });
    } else {
      toast({
        title: "Deck Empty",
        description: "No more cards to draw!",
        variant: "destructive",
      });
    }
  };

  const endTurn = () => {
    setCurrentTurn('opponent');
    setTimeout(opponentTurn, 1000);
  };

  const opponentTurn = () => {
    // Simple AI: Play a card if possible, then attack if possible
    if (opponentField.length < 3 && Math.random() > 0.5) {
      const newCard = { id: Date.now(), name: `Opponent ${opponentField.length + 1}`, attack: 2, defense: 2 };
      setOpponentField([...opponentField, newCard]);
      toast({
        title: "Opponent's Turn",
        description: `Opponent played ${newCard.name}`,
      });
    }

    if (opponentField.length > 0 && playerField.length > 0) {
      const attackingCard = opponentField[0];
      const targetCard = playerField[0];
      const damage = Math.max(0, attackingCard.attack - targetCard.defense);
      setPlayerHealth(prevHealth => Math.max(0, prevHealth - damage));
      setPlayerField(playerField.filter(c => c.id !== targetCard.id));
      toast({
        title: "Opponent's Attack",
        description: `${attackingCard.name} dealt ${damage} damage to ${targetCard.name}`,
      });
    }

    setCurrentTurn('player');
  };

  useEffect(() => {
    if (playerHealth <= 0 || opponentHealth <= 0) {
      toast({
        title: "Game Over",
        description: playerHealth <= 0 ? "You lost!" : "You won!",
        variant: playerHealth <= 0 ? "destructive" : "success",
      });
    }
  }, [playerHealth, opponentHealth, toast]);

  return (
    <div className="relative w-full h-screen bg-amber-100 overflow-hidden">
      {/* Top decorative border */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-brown-800 to-brown-600 flex items-center justify-between px-4">
        <div className="text-white font-bold">Opponent</div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
          <div className="text-white">{opponentHealth}</div>
        </div>
      </div>

      {/* Opponent's field */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
        {opponentField.map((card) => (
          <TeddyCard key={card.id} teddy={card} />
        ))}
      </div>

      {/* Main game board */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-2/3 bg-amber-200 rounded-lg border-4 border-brown-600 flex flex-col justify-between p-4">
        {/* Player's field */}
        <div className="flex justify-center space-x-2 mt-auto">
          {playerField.map((card) => (
            <TeddyCard 
              key={card.id} 
              teddy={card} 
              onClick={() => currentTurn === 'player' && opponentField.length > 0 && attack(card, opponentField[0])}
            />
          ))}
        </div>
      </div>

      {/* Player's hand */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2">
        {playerHand.map((card) => (
          <TeddyCard 
            key={card.id} 
            teddy={card} 
            onClick={() => currentTurn === 'player' && playCard(card)}
          />
        ))}
      </div>

      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-r from-brown-800 to-brown-600 flex items-center justify-between px-4">
        <div className="text-white font-bold">Player</div>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-green-500 rounded-full"></div>
          <div className="text-white">{playerHealth}</div>
        </div>
      </div>

      {/* Game controls */}
      <div className="absolute bottom-20 right-4 space-y-2">
        <Button 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          onClick={drawCard}
          disabled={currentTurn !== 'player' || deck.length === 0}
        >
          Draw Card
        </Button>
        <Button 
          className="w-full bg-green-500 hover:bg-green-600 text-white"
          onClick={endTurn}
          disabled={currentTurn !== 'player'}
        >
          End Turn
        </Button>
      </div>
    </div>
  );
};

export default GameBoard;