export const battleItems = [
  {
    id: 1,
    name: 'Health Potion',
    description: 'Restores 30 health points',
    effect: (battleState, isPlayer) => {
      const healthKey = isPlayer ? 'playerHealth' : 'opponentHealth';
      return {
        ...battleState,
        [healthKey]: Math.min(battleState[healthKey] + 30, 100),
      };
    },
  },
  {
    id: 2,
    name: 'Attack Boost',
    description: 'Increases attack by 20% for 3 turns',
    effect: (battleState, isPlayer) => {
      const boostKey = isPlayer ? 'playerAttackBoost' : 'opponentAttackBoost';
      return {
        ...battleState,
        [boostKey]: (battleState[boostKey] || 0) + 0.2,
        [`${boostKey}Duration`]: 3,
      };
    },
  },
  {
    id: 3,
    name: 'Shield',
    description: 'Blocks the next incoming attack',
    effect: (battleState, isPlayer) => {
      const shieldKey = isPlayer ? 'playerShield' : 'opponentShield';
      return {
        ...battleState,
        [shieldKey]: true,
      };
    },
  },
];

export const getRandomBattleItem = () => {
  return battleItems[Math.floor(Math.random() * battleItems.length)];
};