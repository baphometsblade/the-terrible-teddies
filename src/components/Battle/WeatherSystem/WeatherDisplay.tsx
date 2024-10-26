import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";

export type WeatherType = 'sunny' | 'rainy' | 'stormy' | 'snowy' | 'windy' | 'clear';

interface WeatherDisplayProps {
  weather: WeatherType;
  duration: number;
}

const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ weather, duration }) => {
  const getWeatherIcon = () => {
    switch (weather) {
      case 'sunny':
        return <Sun className="w-8 h-8 text-yellow-500" />;
      case 'rainy':
        return <CloudRain className="w-8 h-8 text-blue-500" />;
      case 'stormy':
        return <CloudLightning className="w-8 h-8 text-purple-500" />;
      case 'snowy':
        return <CloudSnow className="w-8 h-8 text-blue-300" />;
      case 'windy':
        return <Wind className="w-8 h-8 text-gray-500" />;
      default:
        return <Cloud className="w-8 h-8 text-gray-400" />;
    }
  };

  const getWeatherEffect = () => {
    switch (weather) {
      case 'sunny':
        return 'Attack power increased by 20%';
      case 'rainy':
        return 'Defense power increased by 20%';
      case 'stormy':
        return 'Special abilities cost 1 less energy';
      case 'snowy':
        return 'Movement and attack speed reduced';
      case 'windy':
        return '25% chance to miss attacks';
      default:
        return 'No weather effects';
    }
  };

  const getWeatherBackground = () => {
    switch (weather) {
      case 'sunny':
        return 'bg-gradient-to-br from-yellow-100 to-orange-100';
      case 'rainy':
        return 'bg-gradient-to-br from-blue-100 to-gray-100';
      case 'stormy':
        return 'bg-gradient-to-br from-purple-100 to-gray-100';
      case 'snowy':
        return 'bg-gradient-to-br from-blue-50 to-gray-50';
      case 'windy':
        return 'bg-gradient-to-br from-gray-100 to-gray-50';
      default:
        return 'bg-gradient-to-br from-gray-50 to-white';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="weather-display"
      >
        <Card className={`${getWeatherBackground()} border-none shadow-md`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: weather === 'windy' ? 360 : 0 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                {getWeatherIcon()}
              </motion.div>
              <div>
                <h3 className="font-bold text-lg capitalize">{weather} Weather</h3>
                <p className="text-sm text-gray-600">{getWeatherEffect()}</p>
                <p className="text-xs text-gray-500">Duration: {duration} turns</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default WeatherDisplay;