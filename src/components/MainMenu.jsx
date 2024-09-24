import React from 'react';
import { Button } from "@/components/ui/button";

export const MainMenu = ({ onStartGame }) => {
  return (
    <div className="text-center">
      <h1 className="text-6xl font-bold mb-8 text-purple-300">Terrible Teddies</h1>
      <Button 
        onClick={onStartGame}
        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
      >
        Start Game
      </Button>
    </div>
  );
};
