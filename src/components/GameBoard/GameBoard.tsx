import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TeddyCard from '../TeddyCard';
import { useToast } from "@/components/ui/use-toast";
import { generateRandomTeddy, applySpecialAbility, calculateDamage } from '../../utils/gameUtils';
import { TeddyCard as TeddyCardType } from '../../types/types';

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState<TeddyCardType[]>([]);
  const [opponentHand, setOpponentHand] = useState<TeddyCardType[]>([]);
  const [playerField, setPlayerField] = useState<TeddyCardType[]>([]);
  const [opponentField, setOpponentField] = useState<TeddyCardType[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [deck, setDeck] = useState<TeddyCardType[]>([]);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize the game
    const initialDeck = Array(10).fill(null).map(generateRandomTeddy);
    setDeck(initialDeck);
    setPlayerHand(initialDeck.slice(0, 5));
    setOpponentHand(initialDeck.slice(5, 10));
  }, []);

  const playCard = (card: TeddyCardType) => {
    if (currentTurn === 'player' && playerField.length < 3 && playerEnergy >= 1) {
      setPlayerField([...playerField, card]);
      setPlayerHand(playerHand.filter(c => c.id !== card.id));
      setPlayerEnergy(playerEnergy - 1);
      toast({
        title: "Card Played",
        description: `You played ${card.name}`,
      });
    }
  };

  const attack = (attackingCard: TeddyCardType, targetCard: TeddyCardType) => {
    if (currentTurn === 'player' && playerEnergy >= 1) {
      const damage = calculateDamage(attackingCard, targetCard);
      setOpponentHealth(prevHealth => Math.max(0, prevHealth - damage));
      setOpponentField(opponentField.filter(c => c.id !== targetCard.id));
      setPlayerEnergy(playerEnergy - 1);
      toast({
        title: "Attack",
        description: `${attackingCard.name} dealt ${damage} damage to ${targetCard.name}`,
      });
    }
  };

  const useSpecialAbility = (teddy: TeddyCardType) => {
    if (currentTurn === 'player' && playerEnergy >= 2) {
      const result = applySpecialAbility(teddy, playerHealth, opponentHealth, playerField, opponentField);
      if ('playerHealth' in result) setPlayerHealth(result.playerHealth as number);
      if ('opponentHealth' in result) setOpponentHealth(result.opponentHealth as number);
      if ('opponentField' in result) setOpponentField(result.opponentField as TeddyCardType[]);
      if ('attack' in result || 'defense' in result) {
        setPlayerField(playerField.map(t => t.id === teddy.id ? result as TeddyCardType : t));
      }
      setPlayerEnergy(playerEnergy - 2);
      toast({
        title: "Special Ability",
        description: `${teddy.name} used ${teddy.specialAbility.name}`,
      });
    }
  };

  const drawCard = () => {
    if (deck.length > 0 && playerHand.length < 7) {
      const drawnCard = deck[0];
      setPlayerHand([...playerHand, drawnCard]);
      setDeck(deck.slice(1));
      toast({
        title: "Card Drawn",
        description: `You drew ${drawnCard.name}`,
      });
    } else {
      toast({
        title: "Cannot Draw",
        description: deck.length === 0 ? "Deck is empty!" : "Hand is full!",
        variant: "destructive",
      });
    }
  };

  const endTurn = () => {
    setCurrentTurn('opponent');
    setPlayerEnergy(3);
    setTimeout(opponentTurn, 1000);
  };

  const opponentTurn = () => {
    let newOpponentEnergy = 3;
    let newOpponentField = [...opponentField];
    let newOpponentHand = [...opponentHand];
    let newPlayerField = [...playerField];
    let newPlayerHealth = playerHealth;

    // Play cards
    while (newOpponentEnergy > 0 && newOpponentField.length < 3 && newOpponentHand.length > 0) {
      const cardToPlay = newOpponentHand[0];
      newOpponentField.push(cardToPlay);
      newOpponentHand = newOpponentHand.slice(1);
      newOpponentEnergy--;
      toast({
        title: "Opponent's Turn",
        description: `Opponent played ${cardToPlay.name}`,
      });
    }

    // Attack
    for (const attackingCard of newOpponentField) {
      if (newOpponentEnergy > 0 && newPlayerField.length > 0) {
        const targetCard = newPlayerField[0];
        const damage = calculateDamage(attackingCard, targetCard);
        newPlayerHealth = Math.max(0, newPlayerHealth - damage);
        newPlayerField = newPlayerField.filter(c => c.id !== targetCard.id);
        newOpponentEnergy--;
        toast({
          title: "Opponent's Attack",
          description: `${attackingCard.name} dealt ${damage} damage to ${targetCard.name}`,
        });
      } else if (newOpponentEnergy > 0) {
        newPlayerHealth = Math.max(0, newPlayerHealth - attackingCard.attack);
        newOpponentEnergy--;
        toast({
          title: "Opponent's Attack",
          description: `${attackingCard.name} dealt ${attackingCard.attack} damage to you`,
        });
      }
    }

    // Use special abilities
    for (const teddy of newOpponentField) {
      if (newOpponentEnergy >= 2) {
        const result = applySpecialAbility(teddy, opponentHealth, newPlayerHealth, newOpponentField, newPlayerField);
        if ('playerHealth' in result) newPlayerHealth = result.playerHealth as number;
        if ('opponentHealth' in result) setOpponentHealth(result.opponentHealth as number);
        if ('playerField' in result) newPlayerField = result.playerField as TeddyCardType[];
        if ('attack' in result || 'defense' in result) {
          newOpponentField = newOpponentField.map(t => t.id === teddy.id ? result as TeddyCardType : t);
        }
        newOpponentEnergy -= 2;
        toast({
          title: "Opponent's Special Ability",
          description: `${teddy.name} used ${teddy.specialAbility.name}`,
        });
      }
    }

    setOpponentField(newOpponentField);
    setOpponentHand(newOpponentHand);
    setPlayerField(newPlayerField);
    setPlayerHealth(newPlayerHealth);
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
              onSpecialAbility={() => useSpecialAbility(card)}
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
          disabled={currentTurn !== 'player' || deck.length === 0 || playerHand.length >= 7}
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

      {/* Energy display */}
      <div className="absolute top-20 right-4 bg-yellow-400 text-brown-800 px-3 py-1 rounded-full">
        Energy: {currentTurn === 'player' ? playerEnergy : opponentEnergy}
      </div>
    </div>
  );
};

export default GameBoard;