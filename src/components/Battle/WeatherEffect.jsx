import React from 'react';
import { motion } from 'framer-motion';

const WeatherEffect = ({ weather }) => {
  if (!weather) return null;

  const getWeatherIcon = (weatherName) => {
    switch (weatherName) {
      case 'Sunny Day':
        return '☀️';
      case 'Rainy Day':
        return '🌧️';
      case 'Windy Day':
        return '💨';
      case 'Foggy Day':
        return '🌫️';
      default:
        return '🌤️';
    }
  };

  return (
    <motion.div
      className="weather-effect p-2 bg-gray-100 rounded-lg shadow-md"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-1">
        {getWeatherIcon(weather.name)} {weather.name}
      </h3>
      <p className="text-sm text-gray-600">{weather.description}</p>
    </motion.div>
  );
};

export default WeatherEffect;