export const calculateDamage = (attacker, defender) => {
  const baseDamage = attacker.attack - defender.defense;
  return Math.max(0, baseDamage);
};

export const applySpecialMove = (user, target, specialMove) => {
  // Implement special move effects here
  switch (specialMove) {
    case 'Healing Hug':
      user.health += 5;
      break;
    case 'Furry Fury':
      target.defense -= 2;
      break;
    // Add more special moves as needed
    default:
      break;
  }
};