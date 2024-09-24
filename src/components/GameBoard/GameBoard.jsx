import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { Heart, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useGeneratedImages, useUserDeck, useUpdateUserStats } from '../../integrations/supabase';
import { PlayerArea } from './PlayerArea';
import { GameLog } from './GameLog';

const CARD_TYPES = {
  ACTION: 'Action',
  TRAP: 'Trap',
  SPECIAL: 'Special',
  DEFENSE: 'Defense',
  BOOST: 'Boost'
};

export const GameBoard = ({ gameMode, onExit }) => {
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });
  const { toast } = useToast();
  const { data: allCards, isLoading: isLoadingCards } = useGeneratedImages();
  const { data: userDeck } = useUserDeck();
  const updateUserStats = useUpdateUserStats();

  const [audioContext] = useState(() => new (window.AudioContext || window.webkitAudioContext)());

  useEffect(() => {
    if (allCards && userDeck) {
      initializeGame();
    }
  }, [allCards, userDeck]);

  const initializeGame = () => {
    const playerDeckCards = userDeck && userDeck.length > 0 ? userDeck : allCards.slice(0, 20);
    const opponentDeckCards = allCards.slice(20, 40);
    setPlayerDeck(shuffleArray(playerDeckCards));
    setOpponentDeck(shuffleArray(opponentDeckCards));
    dealInitialHands();
  };

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
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

  const playSound = useCallback((frequency, duration) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);
    oscillator.stop(audioContext.currentTime + duration);
  }, [audioContext]);

  const applyCardEffect = (card, isOpponent = false) => {
    const target = isOpponent ? 'player' : 'opponent';
    let effectDescription = '';

    switch(card.type) {
      case CARD_TYPES.ACTION:
        const damage = card.energy_cost * 2;
        if (isOpponent) {
          setPlayerHP(prev => Math.max(0, prev - damage));
        } else {
          setOpponentHP(prev => Math.max(0, prev - damage));
        }
        playSound(330, 0.3);
        effectDescription = `${card.name} deals ${damage} damage to the ${target}!`;
        break;
      case CARD_TYPES.TRAP:
        setActiveEffects(prev => ({
          ...prev,
          [isOpponent ? 'opponent' : 'player']: [...prev[isOpponent ? 'opponent' : 'player'], card]
        }));
        playSound(550, 0.2);
        effectDescription = `${card.name} has been set as a trap.`;
        break;
      case CARD_TYPES.SPECIAL:
        const heal = card.energy_cost;
        if (isOpponent) {
          setOpponentHP(prev => Math.min(30, prev + heal));
        } else {
          setPlayerHP(prev => Math.min(30, prev + heal));
        }
        playSound(660, 0.3);
        effectDescription = `${card.name} heals the ${isOpponent ? 'opponent' : 'player'} for ${heal} HP!`;
        break;
      case CARD_TYPES.DEFENSE:
        setActiveEffects(prev => ({
          ...prev,
          [isOpponent ? 'opponent' : 'player']: [...prev[isOpponent ? 'opponent' : 'player'], card]
        }));
        playSound(440, 0.2);
        effectDescription = `${card.name} provides defense for the ${isOpponent ? 'opponent' : 'player'}.`;
        break;
      case CARD_TYPES.BOOST:
        setMomentumGauge(prev => Math.min(10, prev + card.energy_cost));
        playSound(880, 0.2);
        effectDescription = `${card.name} boosts the momentum gauge by ${card.energy_cost}!`;
        break;
    }

    setGameLog(prev => [...prev, { player: isOpponent ? 'Opponent' : 'You', action: effectDescription }]);
    toast({
      title: card.type,
      description: effectDescription,
    });
  };

  const playCard = (card) => {
    if (currentTurn !== 'player') return;
    if (momentumGauge + card.energy_cost > 10) {
      toast({
        title: "Not enough Momentum!",
        description: "You need more Momentum to play this card.",
        variant: "destructive",
      });
      playSound(200, 0.3);
      return;
    }
    
    setMomentumGauge(prev => prev + card.energy_cost);
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    setLastPlayedCard(card);
    
    playSound(440, 0.2);
    applyCardEffect(card);
    
    if (momentumGauge + card.energy_cost >= 10) {
      endTurn();
    }
  };

  const aiTurn = useCallback(() => {
    if (currentTurn === 'opponent' && gameMode === 'singlePlayer') {
      setTimeout(() => {
        const aiCard = opponentHand[Math.floor(Math.random() * opponentHand.length)];
        setOpponentHand(prev => prev.filter(c => c.id !== aiCard.id));
        
        playSound(330, 0.2);
        applyCardEffect(aiCard, true);
        
        endTurn();
      }, 1000);
    }
  }, [currentTurn, gameMode, opponentHand, playSound]);

  useEffect(() => {
    aiTurn();
  }, [currentTurn, aiTurn]);

  const endTurn = () => {
    setCurrentTurn(prev => prev === 'player' ? 'opponent' : 'player');
    setMomentumGauge(0);
    if (currentTurn === 'player') {
      setPlayerHand(prev => [...prev, ...drawCards(1)]);
    } else {
      setOpponentHand(prev => [...prev, ...drawCards(1, true)]);
    }
    checkActiveEffects();
  };

  const checkActiveEffects = () => {
    const newActiveEffects = { player: [], opponent: [] };
    ['player', 'opponent'].forEach(side => {
      activeEffects[side].forEach(effect => {
        if (effect.type === CARD_TYPES.TRAP) {
          applyCardEffect(effect, side === 'opponent');
        } else {
          newActiveEffects[side].push(effect);
        }
      });
    });
    setActiveEffects(newActiveEffects);
  };

  const checkGameOver = useCallback(() => {
    if (playerHP <= 0 || opponentHP <= 0) {
      const winner = playerHP > 0 ? 'player' : 'opponent';
      updateUserStats.mutate({ 
        games_played: 1, 
        games_won: winner === 'player' ? 1 : 0 
      });
      toast({
        title: "Game Over!",
        description: `${winner === 'player' ? 'You win!' : 'You lose!'}`,
        duration: 5000,
      });
      setTimeout(onExit, 5000);
    }
  }, [playerHP, opponentHP, updateUserStats, onExit, toast]);

  useEffect(() => {
    checkGameOver();
  }, [playerHP, opponentHP, checkGameOver]);

  if (isLoadingCards) {
    return <div>Loading game...</div>;
  }

  return (
    <div className="game-board p-4 bg-gradient-to-b from-pink-100 to-purple-200 rounded-lg shadow-xl">
      <div className="opponent-area mb-6 bg-gradient-to-r from-red-100 to-pink-100 p-4 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-purple-800 mb-2">Opponent's Terrible Teddy</h2>
        <div className="flex items-center mb-2">
          <Heart className="w-6 h-6 text-red-500 mr-2" />
          <Progress value={(opponentHP / 30) * 100} className="w-full h-4 bg-red-200" />
          <p className="text-sm ml-2 text-purple-700 font-semibold">{opponentHP}/30</p>
        </div>
        <div className="flex space-x-2 mt-4 justify-center">
          {opponentHand.map((_, index) => (
            <Card key={index} className="w-16 h-24 bg-gradient-to-br from-red-300 to-pink-300 shadow-md"></Card>
          ))}
        </div>
      </div>

      <div className="game-info mb-6 bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg shadow-md">
        <p className="text-xl font-semibold text-purple-800 mb-2">Current Turn: {currentTurn === 'player' ? 'Your' : 'Opponent\'s'} Turn</p>
        <div className="flex items-center">
          <Zap className="w-6 h-6 text-yellow-500 mr-2" />
          <Progress value={(momentumGauge / 10) * 100} className="w-full h-4 bg-blue-200" />
          <p className="text-sm ml-2 text-purple-700 font-semibold">{momentumGauge}/10</p>
        </div>
      </div>

      <div className="flex mb-6">
        <div className="w-1/2 pr-2">
          {lastPlayedCard && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="last-played-card bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-lg shadow-md"
            >
              <h3 className="text-lg font-semibold text-purple-800 mb-2">Last Played Card</h3>
              <Card className="w-32 h-48 mx-auto bg-gradient-to-br from-yellow-200 to-orange-200 shadow-lg">
                <CardContent className="p-2 flex flex-col justify-between h-full">
                  <div>
                    <img src={lastPlayedCard.url} alt={lastPlayedCard.name} className="w-full h-20 object-cover mb-2 rounded" />
                    <p className="text-sm font-bold text-purple-800">{lastPlayedCard.name}</p>
                    <p className="text-xs text-purple-600">{lastPlayedCard.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-700">Cost: {lastPlayedCard.energy_cost}</p>
                    <p className="text-xs italic text-purple-600">{lastPlayedCard.effect}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
        <div className="w-1/2 pl-2">
          <GameLog logs={gameLog} />
        </div>
      </div>

      <PlayerArea hp={playerHP} maxHp={30} hand={playerHand} onPlayCard={playCard} />

      <div className="mt-6 space-x-4 flex justify-center">
        <Button 
          onClick={endTurn} 
          disabled={currentTurn !== 'player'}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          End Turn
        </Button>
        <Button 
          onClick={onExit} 
          variant="outline"
          className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Surrender
        </Button>
      </div>
    </div>
  );
};