import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const MainMenu = ({ onStartGame, onDeckBuilder, onCollection }) => {
  const [hoveredOption, setHoveredOption] = useState(null);

  const menuOptions = [
    {
      id: 'battle',
      title: 'Battle Arena',
      description: 'Challenge the AI to a card battle!',
      icon: '⚔️',
      color: 'from-red-500 to-orange-500',
      action: onStartGame,
    },
    {
      id: 'deck',
      title: 'Deck Builder',
      description: 'Customize your teddy deck',
      icon: '🃏',
      color: 'from-blue-500 to-purple-500',
      action: onDeckBuilder,
    },
    {
      id: 'collection',
      title: 'Collection',
      description: 'View all your terrible teddies',
      icon: '🧸',
      color: 'from-amber-500 to-yellow-500',
      action: onCollection,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center p-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl opacity-20"
            initial={{
              x: Math.random() * window.innerWidth,
              y: -50,
              rotate: 0
            }}
            animate={{
              y: window.innerHeight + 50,
              rotate: 360
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              delay: Math.random() * 5
            }}
          >
            🧸
          </motion.div>
        ))}
      </div>

      {/* Title */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: 'spring' }}
        className="text-center mb-12 relative z-10"
      >
        <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 mb-2 drop-shadow-lg">
          Terrible Teddies
        </h1>
        <p className="text-purple-200 text-lg">The Naughtiest Card Battle Game</p>
        <div className="flex justify-center gap-2 mt-4">
          <span className="text-3xl">🧸</span>
          <span className="text-3xl">⚔️</span>
          <span className="text-3xl">🧸</span>
        </div>
      </motion.div>

      {/* Menu Options */}
      <div className="flex flex-col md:flex-row gap-6 relative z-10">
        {menuOptions.map((option, index) => (
          <motion.div
            key={option.id}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
            onMouseEnter={() => setHoveredOption(option.id)}
            onMouseLeave={() => setHoveredOption(null)}
          >
            <Card
              className={`
                w-64 h-80 cursor-pointer overflow-hidden
                bg-gradient-to-b ${option.color}
                border-4 border-white/30
                shadow-2xl
                transition-all duration-300
                ${hoveredOption === option.id ? 'scale-110 shadow-yellow-400/50' : 'scale-100'}
              `}
              onClick={option.action}
            >
              <div className="h-full flex flex-col items-center justify-center p-6 text-white">
                <motion.div
                  className="text-6xl mb-4"
                  animate={hoveredOption === option.id ? {
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  } : {}}
                  transition={{ duration: 0.5 }}
                >
                  {option.icon}
                </motion.div>
                <h2 className="text-2xl font-bold mb-2 text-center">{option.title}</h2>
                <p className="text-sm text-white/80 text-center">{option.description}</p>

                <AnimatePresence>
                  {hoveredOption === option.id && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      className="mt-4"
                    >
                      <Button variant="secondary" className="bg-white text-gray-800 hover:bg-gray-100">
                        Play
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-12 text-purple-300 text-sm relative z-10"
      >
        <p>Version 1.0 - Cheeky Teddy Brawl</p>
      </motion.div>
    </div>
  );
};

export default MainMenu;
