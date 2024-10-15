import React from 'react';
import { motion } from 'framer-motion';
import { getRandomWeatherEffect } from '../../utils/weatherEffects';

const WeatherForecast = ({ currentWeather, roundCount }) => {
  const nextWeatherChangeRound = Math.ceil(roundCount / 5) * 5;
  const roundsUntilChange = nextWeatherChangeRound - roundCount;

  const predictedWeather = getRandomWeatherEffect();

  return (
    <motion.div
      className="weather-forecast mt-4 p-4 bg-blue-100 rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-2">Weather Forecast</h3>
      <p>Current Weather: {currentWeather.name}</p>
      <p>Rounds until weather change: {roundsUntilChange}</p>
      <p>Predicted next weather: {predictedWeather.name}</p>
    </motion.div>
  );
};

export default WeatherForecast;