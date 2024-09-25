export const calculateDamage = (attacker, defender) => {
  const baseDamage = attacker.attack - defender.defense;
  return Math.max(0, baseDamage);
};

export const applyStatusEffects = (player, statusEffects) => {
  let updatedPlayer = { ...player };
  statusEffects.forEach(effect => {
    switch (effect.type) {
      case 'POISON':
        updatedPlayer.hp -= effect.value;
        break;
      case 'HEAL':
        updatedPlayer.hp = Math.min(updatedPlayer.hp + effect.value, 30);
        break;
      // Add more status effect types as needed
    }
  });
  return updatedPlayer;
};

export const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};