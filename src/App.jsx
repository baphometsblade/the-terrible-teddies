import React, { useState } from 'react';
import GameBoard from './components/GameBoard';
import UserSubmission from './components/UserSubmission';
import { Button } from "@/components/ui/button";

function App() {
  const [currentView, setCurrentView] = useState('game');

  return (
    <div className="App bg-gray-100 min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-purple-800">Cheeky Teddy Brawl</h1>
      <div className="mb-4 flex justify-center space-x-4">
        <Button onClick={() => setCurrentView('game')}>Play Game</Button>
        <Button onClick={() => setCurrentView('submit')}>Submit Teddy</Button>
      </div>
      {currentView === 'game' ? <GameBoard /> : <UserSubmission />}
    </div>
  );
}

export default App;