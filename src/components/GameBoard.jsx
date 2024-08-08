import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '../integrations/supabase';

export const GameBoard = ({ gameMode, onExit }) => {
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [allCards, setAllCards] = useState([]);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    const { data, error } = await supabase
      .from('generated_images')
      .select('*');
    
    if (error) {
      console.error('Error fetching cards:', error);
    } else {
      setAllCards(data);
      initializeGame(data);
    }
  };

  const initializeGame = (cards) => {
    const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
    setPlayerDeck(shuffledCards.slice(0, 20));
    setOpponentDeck(shuffledCards.slice(20, 40));
    dealInitialHands();
  };

  const dealInitialHands = () => {
    setPlayerHand(drawCards(5));
    setOpponentHand(drawCards(5, true));
  };

  const drawCards = (count, isOpponent = false) => {
    const deck = isOpponent ? opponentDeck : playerDeck;
    const drawnCards = deck.slice(0, count);
    const newDeck = deck.slice(count);
    
    if (isOpponent) {
      setOpponentDeck(newDeck);
    } else {
      setPlayerDeck(newDeck);
    }

    return drawnCards;
  };

  const playCard = (card) => {
    if (momentumGauge + card.energy_cost > 10) {
      alert("Not enough Momentum to play this card!");
      return;
    }
    
    setMomentumGauge(momentumGauge + card.energy_cost);
    setPlayerHand(playerHand.filter(c => c.name !== card.name));
    
    // Implement card effects here
    switch(card.type) {
      case 'Action':
        setOpponentHP(Math.max(0, opponentHP - card.energy_cost * 2));
        break;
      case 'Trap':
        // Trap effects will be handled when opponent attacks
        break;
      case 'Special':
        setPlayerHP(Math.min(30, playerHP + card.energy_cost));
        break;
    }
    
    if (momentumGauge + card.energy_cost >= 10) {
      endTurn();
    }
  };

  const endTurn = () => {
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
    setMomentumGauge(0);
    if (currentTurn === 'player') {
      setPlayerHand([...playerHand, ...drawCards(1)]);
    } else {
      setOpponentHand([...opponentHand, ...drawCards(1, true)]);
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
            <Card key={card.name} className="w-24 h-36 cursor-pointer hover:bg-blue-100 transition-colors duration-200" onClick={() => playCard(card)}>
              <CardContent className="p-2 flex flex-col justify-between h-full">
                <div>
                  <img src={card.url} alt={card.name} className="w-full h-16 object-cover mb-1 rounded" />
                  <p className="text-xs font-bold">{card.name}</p>
                  <p className="text-xs text-gray-600">{card.type}</p>
                </div>
                <div>
                  <p className="text-xs">Cost: {card.energy_cost}</p>
                  <p className="text-xs italic">{card.prompt}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-4 space-x-2 flex justify-center">
        <Button 
          onClick={endTurn} 
          disabled={currentTurn !== 'player'}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors duration-300"
        >
          End Turn
        </Button>
        <Button 
          onClick={() => setShowExitConfirmation(true)} 
          variant="outline"
          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-2 px-4 rounded transition-colors duration-300"
        >
          Surrender
        </Button>
      </div>

      {showExitConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h3 className="text-xl font-bold mb-4">Are you sure you want to surrender?</h3>
            <div className="flex justify-end space-x-4">
              <Button 
                onClick={() => setShowExitConfirmation(false)}
                className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded transition-colors duration-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={onExit}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors duration-300"
              >
                Confirm Surrender
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
