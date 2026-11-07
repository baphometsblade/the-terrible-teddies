import { describe, expect, it } from 'vitest';
import { CREW_NAMES } from '@/utils/opponentDeck';
import { crewTaunt } from './crewVoice';

describe('crew taunts', () => {
  it('gives every named crew a short line, and a stranger a fallback', () => {
    for (const name of CREW_NAMES) {
      const line = crewTaunt(name);
      expect(line.length, name).toBeGreaterThan(10);
      expect(line.length, name).toBeLessThanOrEqual(80);
      expect(line).not.toMatch(/!/);
    }
    expect(crewTaunt('')).toMatch(/underdressed/);
    expect(crewTaunt('the Dumpster Cartel')).toMatch(/alley/);
  });
});
