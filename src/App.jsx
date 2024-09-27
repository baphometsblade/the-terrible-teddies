import React from 'react';
import GameBoard from './components/GameBoard';

function App() {
  return (
    <div className="App bg-gray-100 min-h-screen p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Terrible Teddies</h1>
      <GameBoard />
    </div>
  );
}

export default App;