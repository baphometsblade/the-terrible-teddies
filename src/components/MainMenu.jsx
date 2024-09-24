import React from 'react';
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

export const MainMenu = ({ onStartGame, onOpenShop, onOpenDeckBuilder, onOpenLeaderboard, onGenerateAssets }) => {
  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-6xl font-bold mb-8 text-purple-300">Terrible Teddies</h1>
      <p className="mb-6 text-xl text-purple-200">Welcome to the ultimate ultra-realistic teddy bear brawler!</p>
      <div className="space-y-4">
        <Button 
          onClick={onStartGame} 
          className="w-64 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          Start Game
        </Button>
        <Button 
          onClick={onOpenShop} 
          className="w-64 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          Card Shop
        </Button>
        <Button 
          onClick={onOpenDeckBuilder} 
          className="w-64 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          Deck Builder
        </Button>
        <Button 
          onClick={onOpenLeaderboard} 
          className="w-64 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          Leaderboard
        </Button>
        <Button 
          onClick={onGenerateAssets} 
          className="w-64 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          Generate Assets
        </Button>
      </div>
    </motion.div>
  );
};
