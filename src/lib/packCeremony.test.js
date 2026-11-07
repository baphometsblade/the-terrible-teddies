import { describe, it, expect } from 'vitest';
import { PACK_CEREMONY, PACK_CEREMONY_MAX, packCeremonyLine } from './packCeremony';

describe('pack ceremony', () => {
  it('is a short line from Chuck, not a change to the pack', () => {
    for (const line of PACK_CEREMONY) {
      expect(line.length, line).toBeLessThanOrEqual(PACK_CEREMONY_MAX);
      expect(line, line).not.toMatch(/!/);
      expect(line, line).not.toMatch(/\d+%/);
    }
    expect(packCeremonyLine(() => 0)).toBe(PACK_CEREMONY[0]);
  });
});