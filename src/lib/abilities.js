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

// What a trap or a special does, in words, from the same fields the engine
// reads (GameBoard's applySpecialEffect, and a trap's `amount || 3` when it
// springs).
const effectLine = (card) => {
  const n = card.amount;
  if (card.type === 'trap') {
    return `Springs when an enemy attacks with no creature to hit: ${n || 3} damage to the attacker's side`;
  }
  switch (card.effect) {
    case 'heal': return `Heals you for up to ${n} HP`;
    case 'draw': return `Draw ${n} ${n === 1 ? 'card' : 'cards'}`;
    case 'buff': return `Every creature you have on the table gets +${n} attack`;
    default: return '';
  }
};

/**
 * A card in words, for a screen reader: what the card face shows in badges
 * and icons. Where a card is a control (a hand card, an attacker, a target)
 * its accessible name is only the action ("Play Bar-Fight Barry"), and a
 * button's children are presentational, so without this the cost, the stats,
 * the ability and the card's state never reached assistive tech at all.
 *
 *   describeCard(barry, { cost: 1 })
 *   // 'Costs 1 energy. 2 attack, 1 of 1 HP.'
 *
 * `cost` is the cost the player would pay now (Swarm's discount included);
 * leave it out for a card on the table, where it has been paid. `attack` is
 * the attack the card hits for now (a Royal ally's +1 included).
 */
export const describeCard = (card, { cost, attack } = {}) => {
  const parts = [];
  if (cost !== undefined && cost !== null) parts.push(`Costs ${cost} energy.`);
  if (card.type === 'action') {
    const atk = attack ?? card.attack;
    const bonus = atk - card.attack;
    const hp = card.currentHp ?? card.defense;
    parts.push(`${atk} attack${bonus > 0 ? ` (+${bonus} from a Royal ally)` : ''}, ${hp} of ${card.defense} HP.`);
  } else {
    const line = effectLine(card);
    if (line) parts.push(`${line}.`);
  }
  const rules = abilityRules(card.ability);
  if (rules) parts.push(`${card.ability.charAt(0).toUpperCase()}${card.ability.slice(1)}: ${rules}.`);
  if (card.hasAttacked) parts.push('Exhausted.');
  else if (card.summoningSick) parts.push('Warming Up.');
  if (card.stealthActive) parts.push('Stealthed.');
  return parts.join(' ');
};
