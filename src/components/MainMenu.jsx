import React from 'react';
import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

export const MainMenu = ({ onStartGame }) => {
  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-6xl font-bold mb-8 text-purple-300">Terrible Teddies</h1>
      <p className="mb-6 text-xl text-purple-200">Welcome to the ultimate ultra-realistic teddy bear brawler!</p>
      <Button 
        onClick={onStartGame} 
        className="w-64 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
      >
        Start Game
      </Button>
    </motion.div>
  );
};
