export const weatherEffects = {
  'Sunny': { name: 'Sunny', effect: 'All attacks deal 20% more damage' },
  'Rainy': { name: 'Rainy', effect: 'All healing effects are 20% more effective' },
  'Windy': { name: 'Windy', effect: 'Defend actions grant 1 additional defense' },
  'Foggy': { name: 'Foggy', effect: '25% chance to dodge attacks' },
};

export const applyWeatherEffect = (action, value, weather) => {
  switch (weather) {
    case 'Sunny':
      return action === 'attack' ? value * 1.2 : value;
    case 'Rainy':
      return action === 'heal' ? value * 1.2 : value;
    case 'Windy':
      return action === 'defend' ? value + 1 : value;
    case 'Foggy':
      return action === 'attack' ? (Math.random() < 0.25 ? 0 : value) : value;
    default:
      return value;
  }
};

export const getRandomWeather = () => {
  const weathers = Object.keys(weatherEffects);
  return weathers[Math.floor(Math.random() * weathers.length)];
};