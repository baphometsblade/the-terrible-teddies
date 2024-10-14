const weatherEffects = [
  {
    name: "Sunny Day",
    description: "The warm sun energizes the teddies, slightly increasing their health regeneration.",
    healthEffect: 5,
  },
  {
    name: "Rainy Day",
    description: "The gloomy weather slightly decreases the teddies' health.",
    healthEffect: -3,
  },
  {
    name: "Windy Day",
    description: "Strong winds make it harder for the teddies to move, slightly decreasing their health.",
    healthEffect: -2,
  },
  // Add more weather effects here
];

export const getWeatherEffect = () => {
  return weatherEffects[Math.floor(Math.random() * weatherEffects.length)];
};