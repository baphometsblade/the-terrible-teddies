import React from 'react';
import { motion } from 'framer-motion';

const WeatherEffect = ({ weather }) => {
  if (!weather) return null;

  const weatherAnimations = {
    'Sunny': {
      component: (
        <motion.div
          className="absolute inset-0 bg-yellow-200 opacity-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
        />
      ),
      description: 'The warm sun energizes the teddies.'
    },
    'Rainy': {
      component: (
        <motion.div
          className="absolute inset-0 bg-blue-200 opacity-30"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 0.3 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      ),
      description: 'The rain dampens the teddies\' spirits.'
    },
    'Windy': {
      component: (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-20 h-20 border-t-4 border-blue-500 rounded-full" />
        </motion.div>
      ),
      description: 'Strong winds make it harder for the teddies to move.'
    },
    // Add more weather effects here
  };

  const currentWeather = weatherAnimations[weather.name];

  return (
    <div className="relative">
      {currentWeather.component}
      <p className="text-center mt-2">{currentWeather.description}</p>
    </div>
  );
};

export default WeatherEffect;