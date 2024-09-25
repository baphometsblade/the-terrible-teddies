import React from 'react';
import { Button } from "@/components/ui/button";

export const MainMenu = ({ onStartGame }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-6xl font-bold mb-8 text-purple-300">Terrible Teddies</h1>
      <Button 
        onClick={onStartGame}
        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl mb-4"
      >
        Start Game
      </Button>
    </div>
  );
};
