import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const GameBoard = ({ gameMode, onExit }) => {
  const [playerHP, setPlayerHP] = useState(20);
  const [opponentHP, setOpponentHP] = useState(20);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player');

  useEffect(() => {
    // Initialize the game
    dealInitialHands();
  }, []);

  const dealInitialHands = () => {
    setPlayerHand(generateInitialHand());
    setOpponentHand(generateInitialHand());
  };

  const generateInitialHand = () => {
    // Placeholder function to generate initial hand
    return Array(6).fill().map(() => ({
      id: Math.random().toString(36).substr(2, 9),
      name: 'Placeholder Card',
      type: ['Action', 'Trap', 'Special'][Math.floor(Math.random() * 3)],
      energyCost: Math.floor(Math.random() * 3) + 1,
      effect: 'Placeholder effect'
    }));
  };

  const playCard = (card) => {
    // Placeholder function for playing a card
    console.log('Playing card:', card);
    // Implement card effects here
  };

  const endTurn = () => {
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
    setMomentumGauge(0);
    // Implement turn end effects here
  };

  return (
    <div className="game-board">
      <div className="opponent-area mb-4">
        <h2 className="text-xl font-bold">Opponent (HP: {opponentHP})</h2>
        <div className="flex space-x-2 mt-2">
          {opponentHand.map((card) => (
            <Card key={card.id} className="w-20 h-32 bg-gray-200"></Card>
          ))}
        </div>
      </div>

      <div className="game-info mb-4">
        <p>Current Turn: {currentTurn === 'player' ? 'Your' : 'Opponent\'s'} Turn</p>
        <p>Momentum Gauge: {momentumGauge}</p>
      </div>

      <div className="player-area">
        <h2 className="text-xl font-bold">Your Hand (HP: {playerHP})</h2>
        <div className="flex space-x-2 mt-2">
          {playerHand.map((card) => (
            <Card key={card.id} className="w-20 h-32 cursor-pointer hover:bg-gray-100" onClick={() => playCard(card)}>
              <CardContent className="p-2">
                <p className="text-xs font-bold">{card.name}</p>
                <p className="text-xs">{card.type}</p>
                <p className="text-xs">Cost: {card.energyCost}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-4 space-x-2">
        <Button onClick={endTurn}>End Turn</Button>
        <Button onClick={onExit} variant="outline">Exit Game</Button>
      </div>
    </div>
  );
};
