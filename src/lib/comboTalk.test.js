import { describe, expect, it } from 'vitest';
import { COMBO_PLAY, COMBO_SWING } from './comboTalk';

describe('combo lines', () => {
  it('fits a log line and winks without shouting', () => {
    for (const line of [COMBO_PLAY, COMBO_SWING]) {
      expect(line.length).toBeLessThanOrEqual(80);
      expect(line).not.toMatch(/!/);
      expect(line.length).toBeGreaterThan(10);
    }
  });
});
