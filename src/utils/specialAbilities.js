const specialAbilities = {
  "Whiskey Whiskers": {
    name: "Intoxicating Aroma",
    description: "Releases a potent whiskey scent, confusing the opponent and reducing their attack by 25% for 2 turns.",
    effect: (user, target, battle) => {
      target.attack *= 0.75;
      battle.addEffect({
        name: "Intoxicated",
        duration: 2,
        endTurn: () => {
          target.attack /= 0.75;
        }
      });
      return `${user.name} used Intoxicating Aroma! ${target.name}'s attack was reduced!`;
    }
  },
  "Madame Mistletoe": {
    name: "Festive Frenzy",
    description: "Throws a barrage of ornaments, dealing damage and potentially stunning the opponent for 1 turn.",
    effect: (user, target, battle) => {
      const damage = Math.floor(user.attack * 1.2);
      target.health -= damage;
      if (Math.random() < 0.3) {
        battle.addEffect({
          name: "Stunned",
          duration: 1,
          startTurn: () => false // Prevent turn
        });
        return `${user.name} used Festive Frenzy! ${target.name} took ${damage} damage and was stunned!`;
      }
      return `${user.name} used Festive Frenzy! ${target.name} took ${damage} damage!`;
    }
  },
  "Baron Von Blubber": {
    name: "Pompous Proclamation",
    description: "Issues a grandiose declaration, boosting own defense and lowering opponent's morale (attack).",
    effect: (user, target, battle) => {
      user.defense *= 1.5;
      target.attack *= 0.8;
      battle.addEffect({
        name: "Proclamation",
        duration: 3,
        endTurn: () => {
          user.defense /= 1.5;
          target.attack /= 0.8;
        }
      });
      return `${user.name} used Pompous Proclamation! Defense increased and ${target.name}'s attack decreased!`;
    }
  },
  "Icy Ivan": {
    name: "Polar Plunge",
    description: "Summons a freezing wind, potentially freezing the opponent and skipping their next turn.",
    effect: (user, target, battle) => {
      if (Math.random() < 0.4) {
        battle.addEffect({
          name: "Frozen",
          duration: 1,
          startTurn: () => false // Prevent turn
        });
        return `${user.name} used Polar Plunge! ${target.name} was frozen and will skip their next turn!`;
      }
      return `${user.name} used Polar Plunge, but ${target.name} resisted the freezing wind!`;
    }
  },
  "Lady Lush": {
    name: "Party Popper Surprise",
    description: "Pops a confetti cannon, dealing random damage and potentially confusing the opponent.",
    effect: (user, target, battle) => {
      const damage = Math.floor(Math.random() * user.attack * 2);
      target.health -= damage;
      if (Math.random() < 0.3) {
        battle.addEffect({
          name: "Confused",
          duration: 2,
          startTurn: () => Math.random() < 0.5 // 50% chance to skip turn
        });
        return `${user.name} used Party Popper Surprise! ${target.name} took ${damage} damage and became confused!`;
      }
      return `${user.name} used Party Popper Surprise! ${target.name} took ${damage} damage!`;
    }
  }
};

export const getSpecialAbility = (teddyName) => {
  return specialAbilities[teddyName] || null;
};

export const useSpecialAbility = (user, target, battle) => {
  const ability = getSpecialAbility(user.name);
  if (!ability) {
    return `${user.name} doesn't have a special ability!`;
  }
  return ability.effect(user, target, battle);
};