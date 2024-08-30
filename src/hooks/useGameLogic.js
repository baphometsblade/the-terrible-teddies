import { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";

const INITIAL_HP = 30;
const INITIAL_ENERGY = 3;
const MAX_HAND_SIZE = 5;

export const useGameLogic = () => {
  const [playerHP, setPlayerHP] = useState(INITIAL_HP);
  const [opponentHP, setOpponentHP] = useState(INITIAL_HP);
  const [playerEnergy, setPlayerEnergy] = useState(INITIAL_ENERGY);
  const [opponentEnergy, setOpponentEnergy] = useState(INITIAL_ENERGY);
  const [playerDeck, setPlayerDeck] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [momentumGauge, setMomentumGauge] = useState(0);
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [activeEffects, setActiveEffects] = useState({ player: [], opponent: [] });

  const { toast } = useToast();

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const dealInitialHands = useCallback(() => {
    setPlayerHand(playerDeck.slice(0, MAX_HAND_SIZE));
    setOpponentHand(opponentDeck.slice(0, MAX_HAND_SIZE));
    setPlayerDeck(playerDeck.slice(MAX_HAND_SIZE));
    setOpponentDeck(opponentDeck.slice(MAX_HAND_SIZE));
  }, [playerDeck, opponentDeck]);

  const initializeGame = useCallback((allCards) => {
    const shuffledCards = shuffleArray([...allCards]);
    setPlayerDeck(shuffledCards.slice(0, 20));
    setOpponentDeck(shuffledCards.slice(20, 40));
    setPlayerHP(INITIAL_HP);
    setOpponentHP(INITIAL_HP);
    setPlayerEnergy(INITIAL_ENERGY);
    setOpponentEnergy(INITIAL_ENERGY);
    setMomentumGauge(0);
    setGameLog([]);
    setActiveEffects({ player: [], opponent: [] });
    setIsGameOver(false);
    setWinner(null);
    setCurrentTurn('player');
    dealInitialHands();
  }, [dealInitialHands]);

  const drawCard = (isPlayer) => {
    if (isPlayer) {
      if (playerDeck.length > 0 && playerHand.length < MAX_HAND_SIZE) {
        const [drawnCard, ...remainingDeck] = playerDeck;
        setPlayerHand([...playerHand, drawnCard]);
        setPlayerDeck(remainingDeck);
      }
    } else {
      if (opponentDeck.length > 0 && opponentHand.length < MAX_HAND_SIZE) {
        const [drawnCard, ...remainingDeck] = opponentDeck;
        setOpponentHand([...opponentHand, drawnCard]);
        setOpponentDeck(remainingDeck);
      }
    }
  };

  const playCard = (card) => {
    if (currentTurn !== 'player') return;
    if (playerEnergy < card.energy_cost) {
      toast({
        title: "Not enough energy!",
        description: `You need ${card.energy_cost} energy to play this card.`,
        variant: "destructive",
      });
      return;
    }

    setPlayerHand(playerHand.filter(c => c.id !== card.id));
    setPlayerEnergy(playerEnergy - card.energy_cost);
    setLastPlayedCard(card);

    // Apply card effects
    switch (card.type) {
      case 'Action':
        setOpponentHP(Math.max(0, opponentHP - card.attack));
        break;
      case 'Defense':
        setPlayerHP(Math.min(INITIAL_HP, playerHP + card.defense));
        break;
      case 'Trap':
        setActiveEffects(prev => ({
          ...prev,
          opponent: [...prev.opponent, { type: 'Trap', duration: 2, effect: card.effect }]
        }));
        break;
      case 'Special':
        // Handle special effects (can be expanded based on card abilities)
        break;
      case 'Boost':
        setActiveEffects(prev => ({
          ...prev,
          player: [...prev.player, { type: 'Boost', duration: 2, effect: card.effect }]
        }));
        break;
    }

    // Update momentum gauge
    setMomentumGauge(Math.min(10, momentumGauge + 1));

    // Log the action
    setGameLog(prev => [...prev, { player: 'Player', action: `Played ${card.name}` }]);

    // Check for game over
    if (opponentHP <= 0) {
      endGame('player');
    }
  };

  const applyActiveEffects = () => {
    activeEffects.player.forEach(effect => {
      // Apply player effects
      if (effect.type === 'Boost') {
        // Example: Increase player's attack
        setPlayerAttackBonus(prev => prev + effect.effect.attackBoost);
      }
    });

    activeEffects.opponent.forEach(effect => {
      // Apply opponent effects
      if (effect.type === 'Trap') {
        // Example: Decrease opponent's defense
        setOpponentDefenseReduction(prev => prev + effect.effect.defenseReduction);
      }
    });

    // Reduce duration of effects and remove expired ones
    setActiveEffects(prev => ({
      player: prev.player.map(e => ({ ...e, duration: e.duration - 1 })).filter(e => e.duration > 0),
      opponent: prev.opponent.map(e => ({ ...e, duration: e.duration - 1 })).filter(e => e.duration > 0)
    }));
  };

  // Add this to the returned object in useGameLogic
  return {
    // ... other returned values
    activeEffects,
    applyActiveEffects,
  };

  const endTurn = () => {
    if (currentTurn === 'player') {
      setCurrentTurn('opponent');
      setPlayerEnergy(INITIAL_ENERGY);
      drawCard(true);
      setTimeout(opponentTurn, 1000);
    } else {
      setCurrentTurn('player');
      setOpponentEnergy(INITIAL_ENERGY);
      drawCard(false);
    }
  };

  const opponentTurn = () => {
    // Simple AI: play the first playable card
    const playableCards = opponentHand.filter(card => card.energy_cost <= opponentEnergy);
    if (playableCards.length > 0) {
      const cardToPlay = playableCards[0];
      setOpponentHand(opponentHand.filter(c => c.id !== cardToPlay.id));
      setOpponentEnergy(opponentEnergy - cardToPlay.energy_cost);
      setLastPlayedCard(cardToPlay);

      // Apply card effects
      if (cardToPlay.type === 'Action') {
        setPlayerHP(Math.max(0, playerHP - cardToPlay.attack));
      } else if (cardToPlay.type === 'Defense') {
        setOpponentHP(Math.min(INITIAL_HP, opponentHP + cardToPlay.defense));
      }

      // Log the action
      setGameLog([...gameLog, { player: 'Opponent', action: `Played ${cardToPlay.name}` }]);

      // Check for game over
      if (playerHP <= 0) {
        endGame('opponent');
      }
    }

    // End opponent's turn
    setTimeout(endTurn, 1000);
  };

  const endGame = (winner) => {
    setIsGameOver(true);
    setWinner(winner);
    toast({
      title: `Game Over!`,
      description: `${winner === 'player' ? 'You win!' : 'You lose!'}`,
      variant: winner === 'player' ? "success" : "destructive",
    });
  };

  const useSpecialMove = (moveName) => {
    if (momentumGauge < 10) return;

    setMomentumGauge(0);
    
    switch (moveName) {
      case "Teddy Tornado":
        setOpponentHP(Math.max(0, opponentHP - 5));
        break;
      case "Fluff Armor":
        setPlayerHP(Math.min(INITIAL_HP, playerHP + 5));
        break;
      case "Cuddle Heal":
        setPlayerHP(Math.min(INITIAL_HP, playerHP + 5));
        break;
      default:
        break;
    }

    setGameLog([...gameLog, { player: 'Player', action: `Used special move: ${moveName}` }]);

    if (opponentHP <= 0) {
      endGame('player');
    }
  };

  return {
    playerHP,
    opponentHP,
    playerEnergy,
    opponentEnergy,
    playerHand,
    opponentHand,
    currentTurn,
    momentumGauge,
    lastPlayedCard,
    gameLog,
    isGameOver,
    winner,
    initializeGame,
    playCard,
    endTurn,
    useSpecialMove,
  };
};
