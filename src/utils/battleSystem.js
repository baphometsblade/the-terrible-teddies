export const calculateDamage = (attacker, defender) => {
  const baseDamage = attacker.attack - defender.defense;
  return Math.max(0, baseDamage);
};