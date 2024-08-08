import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export const GameBoard = ({ gameMode, onExit }) => {
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);

  useEffect(() => {
    // Initialize the game
    dealInitialHands();
  }, []);

  const dealInitialHands = () => {
    setPlayerHand(generateInitialHand());
    setOpponentHand(generateInitialHand());
  };

  const generateInitialHand = () => {
    // Generate initial hand of 6 cards
    return Array(6).fill().map(() => drawCard());
  };

  const drawCard = () => {
    const cardTypes = ['Action', 'Trap', 'Special'];
    const cardNames = {
      Action: ['Pillow Fight', 'Tickle Attack', 'Stuffing Punch'],
      Trap: ['Bear Trap', 'Sticky Honey', 'Feather Shield'],
      Special: ['Stuffing Surge', 'Teddy Tantrum', 'Cuddly Comeback']
    };
    const type = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    const name = cardNames[type][Math.floor(Math.random() * cardNames[type].length)];
    return {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      energyCost: Math.floor(Math.random() * 3) + 1,
      effect: `${name} effect placeholder`
    };
  };

  const playCard = (card) => {
    if (momentumGauge + card.energyCost > 10) {
      alert("Not enough Momentum to play this card!");
      return;
    }
    
    setMomentumGauge(momentumGauge + card.energyCost);
    setPlayerHand(playerHand.filter(c => c.id !== card.id));
    
    // Implement card effects here
    switch(card.type) {
      case 'Action':
        setOpponentHP(Math.max(0, opponentHP - card.energyCost * 2));
        break;
      case 'Trap':
        // Trap effects will be handled when opponent attacks
        break;
      case 'Special':
        setPlayerHP(Math.min(30, playerHP + card.energyCost));
        break;
    }
    
    if (momentumGauge + card.energyCost >= 10) {
      endTurn();
    }
  };

  const endTurn = () => {
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
    setMomentumGauge(0);
    if (currentTurn === 'player') {
      setPlayerHand([...playerHand, drawCard()]);
    } else {
      setOpponentHand([...opponentHand, drawCard()]);
    }
  };

  return (
    <div className="game-board p-4 bg-gray-100 rounded-lg">
      <div className="opponent-area mb-4">
        <h2 className="text-xl font-bold">Opponent's Terrible Teddy</h2>
        <Progress value={(opponentHP / 30) * 100} className="w-full mt-2" />
        <p className="text-sm mt-1">HP: {opponentHP}/30</p>
        <div className="flex space-x-2 mt-2">
          {opponentHand.map((card, index) => (
            <Card key={index} className="w-16 h-24 bg-red-200"></Card>
          ))}
        </div>
      </div>

      <div className="game-info mb-4">
        <p className="text-lg font-semibold">Current Turn: {currentTurn === 'player' ? 'Your' : 'Opponent\'s'} Turn</p>
        <Progress value={(momentumGauge / 10) * 100} className="w-full mt-2" />
        <p className="text-sm mt-1">Momentum Gauge: {momentumGauge}/10</p>
      </div>

      <div className="player-area">
        <h2 className="text-xl font-bold">Your Terrible Teddy</h2>
        <Progress value={(playerHP / 30) * 100} className="w-full mt-2" />
        <p className="text-sm mt-1">HP: {playerHP}/30</p>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {playerHand.map((card) => (
            <Card key={card.id} className="w-24 h-36 cursor-pointer hover:bg-blue-100 transition-colors duration-200" onClick={() => playCard(card)}>
              <CardContent className="p-2 flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold">{card.name}</p>
                  <p className="text-xs text-gray-600">{card.type}</p>
                </div>
                <div>
                  <p className="text-xs">Cost: {card.energyCost}</p>
                  <p className="text-xs italic">{card.effect}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-4 space-x-2 flex justify-center">
        <Button onClick={endTurn} disabled={currentTurn !== 'player'}>End Turn</Button>
        <Button onClick={onExit} variant="outline">Surrender</Button>
      </div>
    </div>
  );
};
