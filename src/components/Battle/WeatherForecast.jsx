import React from 'react';
import { motion } from 'framer-motion';
import { getRandomWeatherEffect } from '../../utils/weatherEffects';

const WeatherForecast = ({ currentWeather, roundCount }) => {
  const nextWeatherChangeRound = Math.ceil(roundCount / 5) * 5;
  const roundsUntilChange = nextWeatherChangeRound - roundCount;

  const predictedWeather = getRandomWeatherEffect();

  return (
    <motion.div
      className="weather-forecast mt-4 p-4 bg-blue-100 rounded-lg shadow-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-2">Weather Forecast</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="font-medium">Current Weather:</p>
          <p className="text-blue-600">{currentWeather.name}</p>
        </div>
        <div>
          <p className="font-medium">Rounds until change:</p>
          <p className="text-blue-600">{roundsUntilChange}</p>
        </div>
        <div className="col-span-2">
          <p className="font-medium">Predicted next weather:</p>
          <p className="text-blue-600">{predictedWeather.name}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherForecast;