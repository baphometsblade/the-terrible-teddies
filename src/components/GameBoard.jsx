import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '../integrations/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Heart, Sword, Bear } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const GameBoard = ({ gameMode, onExit }) => {
  const [audioContext] = useState(() => new (window.AudioContext || window.webkitAudioContext)());
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
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const { toast } = useToast();

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

  const playCard = (card) => {
    if (momentumGauge + card.energy_cost > 10) {
      toast({
        title: "Not enough Momentum!",
        description: "You need more Momentum to play this card.",
        variant: "destructive",
      });
      playSound(200, 0.3); // Error sound
      return;
    }
    
    setMomentumGauge(momentumGauge + card.energy_cost);
    setPlayerHand(playerHand.filter(c => c.name !== card.name));
    setLastPlayedCard(card);
    
    playSound(440, 0.2); // Card play sound
    
    // Implement card effects here
    let effectDescription = '';
    switch(card.type) {
      case 'Action':
        const damage = card.energy_cost * 2;
        setOpponentHP(Math.max(0, opponentHP - damage));
        playSound(330, 0.3); // Attack sound
        effectDescription = `${card.name} deals ${damage} damage to the opponent!`;
        toast({
          title: "Attack!",
          description: effectDescription,
          icon: <Sword className="h-4 w-4 text-red-500" />,
        });
        break;
      case 'Trap':
        playSound(550, 0.2); // Trap set sound
        effectDescription = `${card.name} has been set. It will trigger on the opponent's turn.`;
        toast({
          title: "Trap Set!",
          description: effectDescription,
          icon: <Shield className="h-4 w-4 text-blue-500" />,
        });
        break;
      case 'Special':
        const heal = card.energy_cost;
        setPlayerHP(Math.min(30, playerHP + heal));
        playSound(660, 0.3); // Heal sound
        effectDescription = `${card.name} heals you for ${heal} HP!`;
        toast({
          title: "Special Effect!",
          description: effectDescription,
          icon: <Heart className="h-4 w-4 text-green-500" />,
        });
        break;
    }
    
    setGameLog(prevLog => [...prevLog, { player: 'You', action: effectDescription }]);
    
    if (momentumGauge + card.energy_cost >= 10) {
      endTurn();
    }
  };

  const aiTurn = useCallback(() => {
    if (currentTurn === 'opponent' && gameMode === 'singlePlayer') {
      setTimeout(() => {
        const aiCard = opponentHand[Math.floor(Math.random() * opponentHand.length)];
        setOpponentHand(opponentHand.filter(c => c.name !== aiCard.name));
        
        playSound(330, 0.2); // AI play sound
        
        switch(aiCard.type) {
          case 'Action':
            setPlayerHP(Math.max(0, playerHP - aiCard.energy_cost * 2));
            playSound(220, 0.3); // AI attack sound
            break;
          case 'Trap':
            // AI trap logic
            playSound(440, 0.2); // AI trap set sound
            break;
          case 'Special':
            setOpponentHP(Math.min(30, opponentHP + aiCard.energy_cost));
            playSound(550, 0.3); // AI heal sound
            break;
        }
        
        endTurn();
      }, 1000);
    }
  }, [currentTurn, gameMode, opponentHand, playerHP, opponentHP, endTurn, playSound]);

  useEffect(() => {
    aiTurn();
  }, [currentTurn, aiTurn]);

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
      <div className="game-board-container bg-gradient-to-b from-pink-100 to-purple-200 p-6 rounded-xl shadow-lg">
        <div className="opponent-area mb-6 bg-gradient-to-r from-red-100 to-pink-100 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-purple-800 mb-2">Opponent's Terrible Teddy</h2>
          <div className="flex items-center mb-2">
            <Heart className="w-6 h-6 text-red-500 mr-2" />
            <Progress value={(opponentHP / 30) * 100} className="w-full h-4 bg-red-200" />
            <p className="text-sm ml-2 text-purple-700 font-semibold">{opponentHP}/30</p>
          </div>
          <div className="flex space-x-2 mt-4 justify-center">
            <AnimatePresence>
              {opponentHand.map((card, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="w-16 h-24 bg-gradient-to-br from-red-300 to-pink-300 shadow-md transform hover:scale-105 transition-transform duration-200"></Card>
                </motion.div>
              ))}
            </AnimatePresence>
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
                      <p className="text-xs italic text-purple-600">{lastPlayedCard.prompt}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
          <div className="w-1/2 pl-2">
            <div className="game-log bg-gradient-to-r from-indigo-100 to-blue-100 p-4 rounded-lg shadow-md h-64 overflow-y-auto">
              <h3 className="text-lg font-semibold text-purple-800 mb-2">Game Log</h3>
              <ul className="space-y-2">
                {gameLog.map((log, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm text-purple-700"
                  >
                    <span className="font-semibold">{log.player}:</span> {log.action}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="player-area bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-purple-800 mb-2">Your Terrible Teddy</h2>
          <div className="flex items-center mb-2">
            <Shield className="w-6 h-6 text-green-500 mr-2" />
            <Progress value={(playerHP / 30) * 100} className="w-full h-4 bg-green-200" />
            <p className="text-sm ml-2 text-purple-700 font-semibold">{playerHP}/30</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <AnimatePresence>
              {playerHand.map((card) => (
                <motion.div
                  key={card.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card 
                    className="w-32 h-48 cursor-pointer bg-gradient-to-br from-blue-100 to-purple-100 shadow-lg hover:shadow-xl transition-all duration-200" 
                    onClick={() => playCard(card)}
                  >
                    <CardContent className="p-2 flex flex-col justify-between h-full">
                      <div>
                        <img src={card.url} alt={card.name} className="w-full h-20 object-cover mb-2 rounded" />
                        <p className="text-sm font-bold text-purple-800">{card.name}</p>
                        <p className="text-xs text-purple-600">{card.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-700">Cost: {card.energy_cost}</p>
                        <p className="text-xs italic text-purple-600">{card.prompt}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-6 space-x-4 flex justify-center">
        <Button 
          onClick={endTurn} 
          disabled={currentTurn !== 'player'}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          End Turn
        </Button>
        <Button 
          onClick={() => setShowExitConfirmation(true)} 
          variant="outline"
          className="border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
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
