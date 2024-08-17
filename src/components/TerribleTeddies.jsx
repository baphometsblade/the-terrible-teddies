import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '../integrations/supabase';
import { DeckBuilder } from './DeckBuilder';

const CARD_TYPES = {
  TEDDY: 'Teddy',
  ACTION: 'Action',
  ITEM: 'Item'
};

const TerribleTeddies = () => {
  const [gameState, setGameState] = useState('menu');
  const [player1Deck, setPlayer1Deck] = useState([]);
  const [player2Deck, setPlayer2Deck] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [player1HP, setPlayer1HP] = useState(30);
  const [player2HP, setPlayer2HP] = useState(30);
  const { toast } = useToast();

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('terrible_teddies_cards')
        .select('*');
      if (error) throw error;
      shuffleAndDealCards(data);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast({
        title: "Error",
        description: "Failed to load game cards. Please try again.",
        variant: "destructive",
      });
    }
  };

  const shuffleAndDealCards = (cards) => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setPlayer1Deck(shuffled.slice(0, 30));
    setPlayer2Deck(shuffled.slice(30, 60));
  };

  const startGame = () => {
    setGameState('playing');
    setCurrentPlayer(Math.random() < 0.5 ? 1 : 2);
  };

  const playCard = (card, playerNumber) => {
    if (currentPlayer !== playerNumber) return;

    const updateDeck = playerNumber === 1 ? setPlayer1Deck : setPlayer2Deck;
    const opponentHP = playerNumber === 1 ? player2HP : player1HP;
    const setOpponentHP = playerNumber === 1 ? setPlayer2HP : setPlayer1HP;

    updateDeck(prev => prev.filter(c => c.id !== card.id));

    switch (card.type) {
      case CARD_TYPES.TEDDY:
        setOpponentHP(Math.max(0, opponentHP - card.attack));
        break;
      case CARD_TYPES.ACTION:
        // Implement action card effects
        break;
      case CARD_TYPES.ITEM:
        // Implement item card effects
        break;
    }

    checkGameOver();
    setCurrentPlayer(playerNumber === 1 ? 2 : 1);
  };

  const checkGameOver = () => {
    if (player1HP <= 0 || player2HP <= 0) {
      const winner = player1HP > 0 ? 'Player 1' : 'Player 2';
      toast({
        title: "Game Over!",
        description: `${winner} wins!`,
        duration: 5000,
      });
      setGameState('gameOver');
    }
  };

  const renderCard = (card) => (
    <Card key={card.id} className="w-32 h-48 m-2 cursor-pointer hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-2">
        <h3 className="text-sm font-bold">{card.name}</h3>
        <p className="text-xs">{card.type}</p>
        {card.type === CARD_TYPES.TEDDY && <p className="text-xs">Attack: {card.attack}</p>}
        <p className="text-xs italic mt-2">{card.description}</p>
      </CardContent>
    </Card>
  );

  const renderGameBoard = () => (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <h2 className="text-xl font-bold">Player 2 HP: {player2HP}</h2>
        <div className="flex flex-wrap justify-center">
          {player2Deck.slice(0, 5).map(renderCard)}
        </div>
      </div>
      <div className="my-4">
        <h3 className="text-lg font-semibold">Current Turn: Player {currentPlayer}</h3>
      </div>
      <div className="mt-4">
        <h2 className="text-xl font-bold">Player 1 HP: {player1HP}</h2>
        <div className="flex flex-wrap justify-center">
          {player1Deck.slice(0, 5).map(card => (
            <motion.div
              key={card.id}
              whileHover={{ scale: 1.05 }}
              onClick={() => playCard(card, 1)}
            >
              {renderCard(card)}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const handleSaveDeck = (deck) => {
    setPlayer1Deck(deck);
    toast({
      title: "Deck Saved",
      description: "Your custom deck has been saved and will be used in the next game.",
      variant: "success",
    });
    setGameState('menu');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-center mb-6">Terrible Teddies</h1>
      {gameState === 'menu' && (
        <div className="text-center space-y-4">
          <Button onClick={startGame} className="bg-purple-600 hover:bg-purple-700 text-white">
            Start Game
          </Button>
          <Button onClick={() => setGameState('deckBuilder')} className="bg-blue-600 hover:bg-blue-700 text-white">
            Deck Builder
          </Button>
        </div>
      )}
      {gameState === 'playing' && renderGameBoard()}
      {gameState === 'deckBuilder' && <DeckBuilder onSaveDeck={handleSaveDeck} />}
      {gameState === 'gameOver' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
          <Button onClick={() => setGameState('menu')} className="bg-purple-600 hover:bg-purple-700 text-white">
            Back to Menu
          </Button>
        </div>
      )}
    </div>
  );
};

export default TerribleTeddies;