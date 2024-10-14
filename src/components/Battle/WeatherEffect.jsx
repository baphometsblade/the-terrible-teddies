import React from 'react';
import { motion } from 'framer-motion';

const WeatherEffect = ({ weatherEffect }) => {
  if (!weatherEffect) return null;

  const weatherAnimations = {
    Sunny: {
      component: (
        <motion.div
          className="absolute inset-0 bg-yellow-200 opacity-30"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      ),
    },
    Rainy: {
      component: (
        <motion.div
          className="absolute inset-0"
          initial={{ backgroundPosition: '0 -100%' }}
          animate={{ backgroundPosition: '0 100%' }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{
            backgroundImage: 'url("/images/rain.png")',
            backgroundSize: '200px 200px',
            opacity: 0.3,
          }}
        />
      ),
    },
    Windy: {
      component: (
        <motion.div
          className="absolute inset-0"
          animate={{ x: [-10, 10, -10] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          style={{
            backgroundImage: 'url("/images/wind.png")',
            backgroundSize: 'cover',
            opacity: 0.2,
          }}
        />
      ),
    },
    Stormy: {
      component: (
        <>
          <motion.div
            className="absolute inset-0 bg-gray-800 opacity-40"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ repeat: Infinity, duration: 3 }}
          />
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 0.5, times: [0, 0.1, 1] }}
            style={{
              backgroundImage: 'url("/images/lightning.png")',
              backgroundSize: 'cover',
            }}
          />
        </>
      ),
    },
  };

  return (
    <div className="relative">
      <h2 className="text-xl font-bold mb-2">Current Weather: {weatherEffect.name}</h2>
      <p className="mb-4">{weatherEffect.description}</p>
      {weatherAnimations[weatherEffect.name].component}
    </div>
  );
};

export default WeatherEffect;