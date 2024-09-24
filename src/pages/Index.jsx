import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { GameBoard } from '../components/GameBoard/GameBoard';
import { AssetGenerator } from '../components/AssetGenerator';
import { Header } from '../components/Header';
import { motion } from 'framer-motion';

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [assetsGenerated, setAssetsGenerated] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <motion.h1 
          className="text-6xl font-bold text-center mb-8"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Terrible Teddies
        </motion.h1>
        {!assetsGenerated ? (
          <AssetGenerator onComplete={() => setAssetsGenerated(true)} />
        ) : !gameStarted ? (
          <motion.div 
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="mb-6 text-xl">Welcome to the ultimate ultra-realistic teddy bear brawler!</p>
            <Button 
              onClick={() => setGameStarted(true)} 
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Start Game
            </Button>
          </motion.div>
        ) : (
          <GameBoard onExit={() => setGameStarted(false)} />
        )}
      </main>
    </div>
  );
};

export default Index;
