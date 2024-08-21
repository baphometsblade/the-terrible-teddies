import { useState, useEffect, useCallback } from 'react';
import { useGeneratedImages } from '../integrations/supabase';
import { useToast } from "@/components/ui/use-toast";

const CARD_TYPES = {
  ACTION: 'Action',
  TRAP: 'Trap',
  SPECIAL: 'Special',
  DEFENSE: 'Defense',
  BOOST: 'Boost'
};

const INITIAL_ENERGY = 3;
const MAX_ENERGY = 10;

export const useGameLogic = (initialDeck = []) => {
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerDeck, setPlayerDeck] = useState(initialDeck);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [playerEnergy, setPlayerEnergy] = useState(INITIAL_ENERGY);
  const [opponentEnergy, setOpponentEnergy] = useState(INITIAL_ENERGY);
  const { toast } = useToast();
  const { data: allCards, isLoading: isLoadingCards } = useGeneratedImages();

  const [audioContext] = useState(() => new (window.AudioContext || window.webkitAudioContext)());

  useEffect(() => {
    if (allCards && allCards.length > 0 && playerDeck.length === 0) {
      initializeGame();
    }
  }, [allCards, playerDeck]);

  const initializeGame = () => {
    const shuffledCards = shuffleArray([...allCards]);
    setPlayerDeck(prevDeck => prevDeck.length > 0 ? prevDeck : shuffledCards.slice(0, 20));
    setOpponentDeck(shuffledCards.slice(20, 40));
    setPlayerHP(30);
    setOpponentHP(30);
    setPlayerEnergy(INITIAL_ENERGY);
    setOpponentEnergy(INITIAL_ENERGY);
    setMomentumGauge(0);
    setGameLog([]);
    setActiveEffects({ player: [], opponent: [] });
    setIsGameOver(false);
    setWinner(null);
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
    if (playerEnergy < card.energy_cost) {
      toast({
        title: "Not enough Energy!",
        description: `You need ${card.energy_cost} energy to play this card.`,
        variant: "destructive",
      });
      return;
    }
    
    setPlayerEnergy(prev => prev - card.energy_cost);
    setPlayerHand(prev => prev.filter(c => c.id !== card.id));
    setLastPlayedCard(card);
    
    playSound(440, 0.2);
    applyCardEffect(card);
    
    if (playerEnergy - card.energy_cost <= 0) {
      endTurn();
    }
  };

  const aiTurn = useCallback(() => {
    if (currentTurn === 'opponent') {
      setTimeout(() => {
        const playableCards = opponentHand.filter(card => card.energy_cost <= opponentEnergy);
        if (playableCards.length > 0) {
          const aiCard = playableCards[Math.floor(Math.random() * playableCards.length)];
          setOpponentHand(prev => prev.filter(c => c.id !== aiCard.id));
          setOpponentEnergy(prev => prev - aiCard.energy_cost);
          
          playSound(330, 0.2);
          applyCardEffect(aiCard, true);
          
          if (opponentEnergy - aiCard.energy_cost <= 0) {
            endTurn();
          } else {
            aiTurn();
          }
        } else {
          endTurn();
        }
      }, 1000);
    }
  }, [currentTurn, opponentHand, opponentEnergy, playSound]);

  useEffect(() => {
    aiTurn();
  }, [currentTurn, aiTurn]);

  const endTurn = () => {
    setCurrentTurn(prev => prev === 'player' ? 'opponent' : 'player');
    if (currentTurn === 'player') {
      setPlayerEnergy(Math.min(MAX_ENERGY, playerEnergy + 1));
      setPlayerHand(prev => [...prev, ...drawCards(1)]);
    } else {
      setOpponentEnergy(Math.min(MAX_ENERGY, opponentEnergy + 1));
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

  const useSpecialMove = (moveName) => {
    if (momentumGauge < 10) return;

    let effectDescription = '';
    switch (moveName) {
      case "Teddy Tornado":
        setOpponentHP(prev => Math.max(0, prev - 5));
        effectDescription = "Teddy Tornado deals 5 damage to the opponent!";
        break;
      case "Fluff Armor":
        setActiveEffects(prev => ({
          ...prev,
          player: [...prev.player, { type: CARD_TYPES.DEFENSE, energy_cost: 5, name: "Fluff Armor" }]
        }));
        effectDescription = "Fluff Armor provides 5 defense points!";
        break;
      case "Cuddle Heal":
        setPlayerHP(prev => Math.min(30, prev + 5));
        effectDescription = "Cuddle Heal restores 5 HP!";
        break;
    }

    setMomentumGauge(0);
    setGameLog(prev => [...prev, { player: 'You', action: effectDescription }]);
    toast({
      title: "Special Move",
      description: effectDescription,
    });
    playSound(1100, 0.5);
    endTurn();
  };

  useEffect(() => {
    if (playerHP <= 0 || opponentHP <= 0) {
      setIsGameOver(true);
      setWinner(playerHP > 0 ? 'player' : 'opponent');
    }
  }, [playerHP, opponentHP]);

  return {
    playerHP,
    opponentHP,
    playerHand,
    opponentHand,
    currentTurn,
    momentumGauge,
    lastPlayedCard,
    gameLog,
    playCard,
    endTurn,
    playerDeck,
    opponentDeck,
    isGameOver,
    winner,
    isLoadingCards,
    useSpecialMove,
    initializeGame,
    playerEnergy,
    opponentEnergy,
  };
};