import React from 'react';
import GameBoard from './components/GameBoard';

function App() {
  return (
    <div className="App bg-gray-100 min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-purple-800">Cheeky Teddy Brawl</h1>
      <GameBoard />
    </div>
  );
}

export default App;