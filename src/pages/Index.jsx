import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import TeddyCard from '../components/TeddyCard';
import BattleArena from '../components/BattleArena';
import { generateTeddyBears } from '../utils/teddyGenerator';
import { generateBackgroundImage } from '../utils/imageGenerator';

const Index = () => {
  const [gameState, setGameState] = useState('menu');
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);
  const [teddyCollection, setTeddyCollection] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState(null);

  useEffect(() => {
    const fetchBackgroundImage = async () => {
      const image = await generateBackgroundImage('cheeky teddy bear battle');
      setBackgroundImage(image);
    };

    fetchBackgroundImage();
  }, []);

  const startGame = async () => {
    const generatedTeddies = await generateTeddyBears(5);
    setTeddyCollection(generatedTeddies);
    setGameState('selection');
  };

  const selectTeddy = (teddy) => {
    setPlayerTeddy(teddy);
    const remainingTeddies = teddyCollection.filter(t => t.id !== teddy.id);
    setOpponentTeddy(remainingTeddies[Math.floor(Math.random() * remainingTeddies.length)]);
    setGameState('battle');
  };

  const handleBattleEnd = (result) => {
    alert(result === 'win' ? 'You won!' : 'You lost!');
    setGameState('menu');
  };

  return (
    <div 
      className="container mx-auto px-4 py-8 min-h-screen"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <h1 className="text-4xl font-bold mb-4 text-center text-white">Terrible Teddies</h1>
      {gameState === 'menu' && (
        <div className="text-center">
          <p className="mb-4 text-white">Welcome to the cheeky world of battling teddies!</p>
          <Button onClick={startGame} className="bg-purple-500 hover:bg-purple-600 text-white">
            Start Game
          </Button>
        </div>
      )}
      {gameState === 'selection' && (
        <div>
          <h2 className="text-2xl font-bold mb-4 text-white">Select Your Teddy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teddyCollection.map(teddy => (
              <TeddyCard key={teddy.id} teddy={teddy} onSelect={selectTeddy} />
            ))}
          </div>
        </div>
      )}
      {gameState === 'battle' && playerTeddy && opponentTeddy && (
        <BattleArena
          playerTeddy={playerTeddy}
          opponentTeddy={opponentTeddy}
          onBattleEnd={handleBattleEnd}
        />
      )}
    </div>
  );
};

export default Index;