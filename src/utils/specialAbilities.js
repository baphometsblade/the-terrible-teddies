const specialAbilities = {
  "Whiskey Whiskers": {
    name: "On the Rocks",
    description: "Lowers the opponent's defense by 2 with his intoxicating charisma.",
    energyCost: 2,
    effect: (attacker, defender, battleState) => {
      const newDefense = Math.max(0, defender.defense - 2);
      return {
        ...battleState,
        opponentDefense: newDefense,
        battleLog: [...battleState.battleLog, `${attacker.name} uses On the Rocks, lowering ${defender.name}'s defense to ${newDefense}!`],
      };
    },
  },
  "Madame Mistletoe": {
    name: "Sneak Kiss",
    description: "Stuns the opponent with a surprise smooch, causing them to skip their next turn.",
    energyCost: 3,
    effect: (attacker, defender, battleState) => {
      return {
        ...battleState,
        opponentStunned: true,
        battleLog: [...battleState.battleLog, `${attacker.name} uses Sneak Kiss, stunning ${defender.name} for the next turn!`],
      };
    },
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

export const useSpecialAbility = (attacker, defender, battleState) => {
  const ability = getSpecialAbility(attacker.name);
  if (!ability) return battleState;

  return ability.effect(attacker, defender, battleState);
};
