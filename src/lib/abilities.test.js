import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ABILITY_RULES, abilityRules, describeCard } from './abilities';
import { ALL_CARDS } from '@/stores/gameStore';

// The abilities the catalog guard accepts, read from cardSchema.test.js itself
// rather than restated here, so adding a keyword there without rules text here
// fails this file (the same regex-from-source approach gemBundles.test.js uses
// for the price tables).
const schemaSource = readFileSync(resolve(process.cwd(), 'src/stores/cardSchema.test.js'), 'utf8');
const listMatch = schemaSource.match(/const VALID_ABILITIES = \[([^\]]*)\]/);
const SCHEMA_ABILITIES = listMatch ? [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];

describe('ability rules text', () => {
  it('finds the list of allowed abilities in cardSchema.test.js', () => {
    // Without this the loop below could pass vacuously on a renamed constant.
    expect(SCHEMA_ABILITIES.length).toBeGreaterThan(1);
  });

  it('describes every ability the card schema allows', () => {
    const missing = SCHEMA_ABILITIES.filter((a) => a !== 'none' && !abilityRules(a));
    expect(missing, `no rules text for: ${missing.join(', ')}`).toEqual([]);
  });

  it('describes every ability a card in the catalog actually carries', () => {
    const carried = [...new Set(ALL_CARDS.map((c) => c.ability).filter((a) => a && a !== 'none'))];
    expect(carried.length).toBeGreaterThan(0);
    const missing = carried.filter((a) => !abilityRules(a));
    expect(missing, `no rules text for: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no rules text for an ability the schema does not allow', () => {
    // Text for a keyword no card can carry would explain a rule that does not exist.
    const stray = Object.keys(ABILITY_RULES).filter((a) => !SCHEMA_ABILITIES.includes(a));
    expect(stray).toEqual([]);
  });

  it('returns nothing for no ability, and never a prototype member', () => {
    expect(abilityRules('none')).toBe('');
    expect(abilityRules(undefined)).toBe('');
    expect(abilityRules('constructor')).toBe('');
    expect(abilityRules('toString')).toBe('');
  });
});

// A card that is a control is named only by its action ("Play X"), and a
// button's children are presentational, so a screen reader hears nothing of
// the card face unless this says it.
describe('describeCard', () => {
  const byName = (name) => ALL_CARDS.find((c) => c.name === name);

  it('reads a hand creature: the cost it would take, its attack and HP', () => {
    expect(describeCard(byName('Bar-Fight Barry'), { cost: 1 })).toBe('Costs 1 energy. 2 attack, 1 of 1 HP.');
  });

  it('reads a table creature without a cost, with its wounds, its ability, its state and a Royal ally', () => {
    const sally = { ...byName('Shit-Talk Sally'), currentHp: 1, summoningSick: true };
    expect(describeCard(sally, { attack: 3 })).toBe(
      `3 attack (+1 from a Royal ally), 1 of 3 HP. Taunt: ${ABILITY_RULES.taunt}. Warming Up.`,
    );
    expect(describeCard({ ...sally, summoningSick: false, hasAttacked: true })).toMatch(/2 attack, 1 of 3 HP\. .* Exhausted\.$/);
    expect(describeCard({ ...byName('Peeping Pete'), stealthActive: true })).toMatch(/Stealthed\.$/);
  });

  it('reads a trap and each kind of special by what it does', () => {
    expect(describeCard(byName('Honey Trap'), { cost: 2 }))
      .toBe("Costs 2 energy. Springs when an enemy attacks with no creature to hit: 3 damage to the attacker's side.");
    expect(describeCard(byName('Emergency Fluff Job'), { cost: 3 })).toBe('Costs 3 energy. Heals you for up to 5 HP.');
  });

  // Derived from the catalog, so a new effect without words fails here.
  it('gives every trap and special in the catalog a line of what it does', () => {
    const silent = ALL_CARDS
      .filter((c) => c.type !== 'action')
      .filter((c) => !/^Costs \d+ energy\. \S/.test(describeCard(c, { cost: c.cost })))
      .map((c) => `${c.name} (${c.effect})`);
    expect(silent).toEqual([]);
  });
});
