import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGeneratedImages } from '../integrations/supabase';

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [selectedCard, setSelectedCard] = useState(null);

  const { data: generatedImages } = useGeneratedImages();

  useEffect(() => {
    if (generatedImages) {
      const shuffledCards = [...generatedImages].sort(() => Math.random() - 0.5);
      setPlayerHand(shuffledCards.slice(0, 5));
      setOpponentHand(shuffledCards.slice(5, 10));
    }
  }, [generatedImages]);

  const playCard = (card) => {
    if (currentTurn === 'player') {
      setOpponentHealth(prev => Math.max(0, prev - card.attack));
      setPlayerHand(prev => prev.filter(c => c.id !== card.id));
      setCurrentTurn('opponent');
      setTimeout(opponentTurn, 1000);
    }
  };

  const opponentTurn = () => {
    if (opponentHand.length > 0) {
      const randomCard = opponentHand[Math.floor(Math.random() * opponentHand.length)];
      setPlayerHealth(prev => Math.max(0, prev - randomCard.attack));
      setOpponentHand(prev => prev.filter(c => c.id !== randomCard.id));
    }
    setCurrentTurn('player');
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Opponent (Health: {opponentHealth})</h2>
        <div className="flex space-x-2">
          {opponentHand.map(card => (
            <Card key={card.id} className="w-20 h-32 bg-red-100">
              <CardContent className="p-2">
                <p className="text-xs">{card.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-bold">Player (Health: {playerHealth})</h2>
        <div className="flex space-x-2">
          {playerHand.map(card => (
            <Card 
              key={card.id} 
              className={`w-20 h-32 cursor-pointer ${selectedCard?.id === card.id ? 'border-2 border-blue-500' : ''}`}
              onClick={() => setSelectedCard(card)}
            >
              <CardContent className="p-2">
                <img src={card.url} alt={card.name} className="w-full h-16 object-cover mb-1" />
                <p className="text-xs">{card.name}</p>
                <p className="text-xs">ATK: {card.attack}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <Button 
        onClick={() => selectedCard && playCard(selectedCard)} 
        disabled={currentTurn !== 'player' || !selectedCard}
      >
        Play Selected Card
      </Button>
      
      <p className="mt-4">Current Turn: {currentTurn}</p>
    </div>
  );
};

export default GameBoard;