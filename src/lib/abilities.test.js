import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ABILITY_RULES, abilityRules } from './abilities';
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
