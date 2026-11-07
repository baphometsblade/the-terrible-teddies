// One house rule per night, remembered on this device only. It is not part of
// the cloud save: a phone can play Boss night without rewriting the account.

const KEY = 'terrible-teddies-house-rule';

export const HOUSE_RULES = [
  { id: 'standard', label: 'House', blurb: 'No extras. Just the night.', hp: 0, energy: 0, damage: 0, boss: false, chuckHp: 0 },
  { id: 'openBar', label: 'Open bar', blurb: 'One more energy. Try to behave.', hp: 0, energy: 1, damage: 0, boss: false, chuckHp: 0 },
  { id: 'rough', label: 'Rough trade', blurb: 'Every hit lands one harder.', hp: 0, energy: 0, damage: 1, boss: false, chuckHp: 0 },
  { id: 'twoDrink', label: 'Two drinks', blurb: 'Both of you start on 20.', hp: -10, energy: 0, damage: 0, boss: false, chuckHp: 0 },
  { id: 'boss', label: 'Boss night', blurb: 'Donna works the door, and she mends him.', hp: 0, energy: 0, damage: 0, boss: true, chuckHp: 10 },
];

export const STANDARD_RULE = HOUSE_RULES[0];

export const houseRuleById = (id) => HOUSE_RULES.find((rule) => rule.id === id) || STANDARD_RULE;

export const readHouseRule = () => {
  try {
    return houseRuleById(localStorage.getItem(KEY));
  } catch {
    return STANDARD_RULE;
  }
};

export const writeHouseRule = (id) => {
  try {
    localStorage.setItem(KEY, houseRuleById(id).id);
  } catch {
    /* private mode: the night stays standard */
  }
  return houseRuleById(id);
};

export const BOSS_CARD = {
  id: 109,
  name: 'Door-Staff Donna',
  attack: 3,
  defense: 6,
  type: 'action',
  cost: 4,
  ability: 'taunt',
  tribe: 'staff',
  rarity: 'legendary',
  description: 'She works the door. While she is catcalling, Chuck gets a little less dead.',
};

export const BOSS_HEAL = 2;

export const bossMends = (field) => field.some((card) => card.type === 'action' && card.ability === 'taunt');
