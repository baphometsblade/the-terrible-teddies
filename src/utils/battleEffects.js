const battleEffects = [
  {
    name: "Stuffing Storm",
    description: "A flurry of stuffing fills the air, reducing all attacks by 1 for this turn.",
    effect: (battleState) => ({
      ...battleState,
      playerAttackModifier: -1,
      opponentAttackModifier: -1,
      battleLog: [...battleState.battleLog, "A Stuffing Storm reduces all attacks!"],
    }),
  },
  {
    name: "Button Boost",
    description: "A shower of buttons rains down, increasing all defenses by 1 for this turn.",
    effect: (battleState) => ({
      ...battleState,
      playerDefenseBoost: battleState.playerDefenseBoost + 1,
      opponentDefenseBoost: battleState.opponentDefenseBoost + 1,
      battleLog: [...battleState.battleLog, "A Button Boost increases all defenses!"],
    }),
  },
  {
    name: "Fabric Frenzy",
    description: "The arena is filled with swirling fabric, granting a 20% chance to dodge attacks this turn.",
    effect: (battleState) => ({
      ...battleState,
      playerDodgeChance: 0.2,
      opponentDodgeChance: 0.2,
      battleLog: [...battleState.battleLog, "A Fabric Frenzy increases dodge chances!"],
    }),
  },
  // Add more battle events here
];

export const generateRandomBattleEffect = () => {
  return battleEffects[Math.floor(Math.random() * battleEffects.length)];
};

export const applyBattleEffect = (battleState) => {
  const event = generateRandomBattleEffect();
  return event.effect(battleState);
};