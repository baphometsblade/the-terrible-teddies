const powerUps = [
  {
    name: "Stuffing Surge",
    description: "Increases attack power by 50% for 2 turns",
    duration: 2,
    effect: (teddy) => {
      teddy.attack *= 1.5;
      return teddy;
    }
  },
  {
    name: "Cuddle Armor",
    description: "Doubles defense for 3 turns",
    duration: 3,
    effect: (teddy) => {
      teddy.defense *= 2;
      return teddy;
    }
  },
  {
    name: "Fluff Regeneration",
    description: "Heals 20% of max health each turn for 3 turns",
    duration: 3,
    effect: (teddy) => {
      teddy.health += Math.floor(teddy.maxHealth * 0.2);
      if (teddy.health > teddy.maxHealth) teddy.health = teddy.maxHealth;
      return teddy;
    }
  },
  {
    name: "Button Eye Beam",
    description: "Next attack deals double damage",
    duration: 1,
    effect: (teddy) => {
      teddy.nextAttackMultiplier = 2;
      return teddy;
    }
  }
];

export const getRandomPowerUp = () => {
  return powerUps[Math.floor(Math.random() * powerUps.length)];
};

export const applyPowerUp = (teddy, powerUp) => {
  return powerUp.effect(teddy);
};