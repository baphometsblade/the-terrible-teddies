import { describe, expect, it } from 'vitest';
import { BOSS_CARD, HOUSE_RULES, bossMends, houseRuleById, readHouseRule, writeHouseRule } from './houseRules';

describe('house rules', () => {
  it('offers five nights and falls back to the plain one', () => {
    expect(HOUSE_RULES.map((rule) => rule.id)).toEqual(['standard', 'openBar', 'rough', 'twoDrink', 'boss']);
    expect(houseRuleById('nope').id).toBe('standard');
    expect(houseRuleById('rough').damage).toBe(1);
    expect(houseRuleById('twoDrink').hp).toBe(-10);
    expect(houseRuleById('boss').boss).toBe(true);
  });

  it('remembers the choice on this device', () => {
    localStorage.clear();
    expect(readHouseRule().id).toBe('standard');
    writeHouseRule('openBar');
    expect(readHouseRule().id).toBe('openBar');
    writeHouseRule('not-a-rule');
    expect(readHouseRule().id).toBe('standard');
  });

  it('mends Chuck only while a Catcall is still working the door', () => {
    expect(bossMends([{ type: 'action', ability: 'taunt' }])).toBe(true);
    expect(bossMends([{ type: 'action', ability: 'none' }])).toBe(false);
    expect(BOSS_CARD.ability).toBe('taunt');
    expect(BOSS_CARD.id).toBeGreaterThan(108);
  });
});
