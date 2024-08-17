import React, { useState, useEffect, useCallback } from 'react';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { LastPlayedCard } from './LastPlayedCard';
import { GameLog } from './GameLog';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import confetti from 'canvas-confetti';

const CARD_TYPES = {
  TEDDY: 'Teddy',
  ACTION: 'Action',
  ITEM: 'Item'
};

export const GameBoard = ({ player1Deck, player2Deck, onExit }) => {
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    dealInitialHands();
  }, []);

  const dealInitialHands = () => {
    setPlayerHand(player1Deck.slice(0, 5));
    setOpponentHand(player2Deck.slice(0, 5));
  };

  const playCard = (card) => {
    if (currentTurn !== 'player') return;
    
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    setLastPlayedCard(card);
    
    applyCardEffect(card);
    
    endTurn();
  };

  const applyCardEffect = (card) => {
    let effectDescription = '';

    switch(card.type) {
      case CARD_TYPES.TEDDY:
        const damage = card.attack || 2;
        setOpponentHP(prev => Math.max(0, prev - damage));
        effectDescription = `${card.name} deals ${damage} damage with its ${card.special_ability || 'mischievous antics'}!`;
        break;
      case CARD_TYPES.ACTION:
        // Implement action card effects
        effectDescription = `${card.name} causes chaos with ${card.effect || 'a hilarious prank'}!`;
        break;
      case CARD_TYPES.ITEM:
        // Implement item card effects
        effectDescription = `${card.name} equips a ${card.item_name || 'ridiculous item'}, boosting its naughtiness!`;
        break;
    }

    setGameLog(prev => [...prev, { player: 'You', action: effectDescription }]);
    toast({
      title: card.type,
      description: effectDescription,
    });
  };

  const aiTurn = useCallback(() => {
    if (currentTurn === 'opponent') {
      setTimeout(() => {
        const aiCard = opponentHand[Math.floor(Math.random() * opponentHand.length)];
        setOpponentHand(prev => prev.filter(c => c.id !== aiCard.id));
        
        let effectDescription = '';
        switch(aiCard.type) {
          case CARD_TYPES.TEDDY:
            const damage = aiCard.attack || 2;
            setPlayerHP(prev => Math.max(0, prev - damage));
            effectDescription = `${aiCard.name} attacks you with ${aiCard.special_ability || 'its fluffy wrath'}!`;
            break;
          case CARD_TYPES.ACTION:
            effectDescription = `${aiCard.name} unleashes ${aiCard.effect || 'a devious scheme'}!`;
            break;
          case CARD_TYPES.ITEM:
            effectDescription = `${aiCard.name} uses ${aiCard.item_name || 'a peculiar gadget'} against you!`;
            break;
        }

        setGameLog(prev => [...prev, { player: 'Opponent', action: effectDescription }]);
        toast({
          title: "Opponent's Turn",
          description: effectDescription,
        });
        
        endTurn();
      }, 1000);
    }
  }, [currentTurn, opponentHand]);

  useEffect(() => {
    aiTurn();
  }, [currentTurn, aiTurn]);

  const endTurn = () => {
    setCurrentTurn(prev => prev === 'player' ? 'opponent' : 'player');
    if (currentTurn === 'player') {
      setPlayerHand(prev => [...prev, player1Deck[Math.floor(Math.random() * player1Deck.length)]]);
    } else {
      setOpponentHand(prev => [...prev, player2Deck[Math.floor(Math.random() * player2Deck.length)]]);
    }
  };

  useEffect(() => {
    if (playerHP <= 0 || opponentHP <= 0) {
      setIsGameOver(true);
      setWinner(playerHP > 0 ? 'player' : 'opponent');
      if (playerHP > 0) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [playerHP, opponentHP]);

  return (
    <div className="game-board p-4 bg-gradient-to-b from-pink-100 to-purple-200 rounded-lg shadow-xl">
      <OpponentArea hp={opponentHP} hand={opponentHand} />
      <GameInfo currentTurn={currentTurn} />
      <div className="flex mb-6">
        <LastPlayedCard card={lastPlayedCard} />
        <GameLog log={gameLog} />
      </div>
      <PlayerArea 
        hp={playerHP} 
        hand={playerHand} 
        onPlayCard={playCard} 
        currentTurn={currentTurn}
      />
      <div className="mt-6 flex justify-center space-x-4">
        <Button 
          onClick={onExit}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          Surrender
        </Button>
      </div>
      {isGameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <h2 className="text-2xl font-bold mb-4">{winner === 'player' ? 'You Win!' : 'You Lose!'}</h2>
            <p className="mb-4">
              {winner === 'player' 
                ? 'Congratulations! Your terrible teddies reign supreme!' 
                : 'Oh no! Your teddies have been out-naughtied!'}
            </p>
            <Button onClick={onExit} className="mt-4">Back to Menu</Button>
          </div>
        </div>
      )}
    </div>
  );
};