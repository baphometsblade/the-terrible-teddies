// What each card ability does, in one line of rules text. The single source:
// the battle board's ability callout reads it, and so can any screen that
// explains a card. It used to live inside GameBoard, where nothing else could
// reach it, so the collection had no way to say what Royal or Swarm meant.
//
// Each line states what the engine actually does (src/utils/battleUtils.js),
// not what the keyword suggests: Shield halves a hit rounded down, Fury
// counts hits survived, not hits taken, and stops at +3.
export const ABILITY_RULES = {
  taunt: 'Enemies must attack this card first',
  piercing: 'Cuts through Shield: deals full damage to shielded cards',
  shield: 'Takes half damage (rounded down) unless the attacker has Piercing',
  stealth: "Can't be targeted for one turn after it's played",
  protect: "While it's on the field, its allies can't be targeted",
  fury: 'Gains +1 attack each time it survives a hit, up to +3',
  swarm: 'Costs 1 less energy (min 1) if you already control another creature',
  royal: 'Other creatures you control get +1 attack while this is on the field',
};

// The rules text for an ability, or '' for a card with none ('none', or a
// missing field). An own-property lookup, so a name that happens to match an
// Object.prototype member ('constructor') can never come back as a function.
export const abilityRules = (ability) =>
  (ability && Object.prototype.hasOwnProperty.call(ABILITY_RULES, ability) ? ABILITY_RULES[ability] : '');
