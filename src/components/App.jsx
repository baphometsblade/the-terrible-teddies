import React, { useState } from 'react';
import { MainMenu } from './MainMenu';
import { GameBoard } from './GameBoard';

const App = () => {
  const [gameState, setGameState] = useState('menu');

  const startGame = () => setGameState('playing');
  const returnToMenu = () => setGameState('menu');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center">
      {gameState === 'menu' ? (
        <MainMenu onStartGame={startGame} />
      ) : (
        <GameBoard onExitGame={returnToMenu} />
      )}
    </div>
  );
};

export default App;
