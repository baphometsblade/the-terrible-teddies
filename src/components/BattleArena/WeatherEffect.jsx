import React from 'react';
import { motion } from 'framer-motion';
import { Cloud, Sun, CloudRain, Wind } from 'lucide-react';

const WeatherEffect = ({ weather }) => {
  const getWeatherIcon = () => {
    switch (weather.name) {
      case 'Cloudy':
        return <Cloud className="w-8 h-8 text-gray-500" />;
      case 'Sunny':
        return <Sun className="w-8 h-8 text-yellow-500" />;
      case 'Rainy':
        return <CloudRain className="w-8 h-8 text-blue-500" />;
      case 'Windy':
        return <Wind className="w-8 h-8 text-teal-500" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="weather-effect p-2 bg-white rounded-lg shadow-md flex items-center space-x-2"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {getWeatherIcon()}
      <div>
        <h3 className="text-lg font-semibold">{weather.name}</h3>
        <p className="text-sm text-gray-600">{weather.description}</p>
      </div>
    </motion.div>
  );
};

export default WeatherEffect;