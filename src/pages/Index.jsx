import React, { useState } from 'react';
import { MainMenu } from '../components/MainMenu';
import { GameBoard } from '../components/GameBoard';

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 p-8">
      {!gameStarted ? (
        <MainMenu onStartGame={() => setGameStarted(true)} />
      ) : (
        <GameBoard onExitGame={() => setGameStarted(false)} />
      )}
    </div>
  );
};

export default Index;
