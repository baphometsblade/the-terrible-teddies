import { describe, it, expect } from 'vitest';
import { LOADING_TIPS, LOADING_TIP_MAX, loadingTip } from './loadingTips';

describe('loading tips', () => {
  it('are Chuck being a host, and they fit under the spinner', () => {
    expect(LOADING_TIPS.length).toBeGreaterThanOrEqual(6);
    for (const line of LOADING_TIPS) {
      expect(line.length, line).toBeLessThanOrEqual(LOADING_TIP_MAX);
      expect(line, line).toBe(line.trim());
      expect(line, line).not.toMatch(/!/);
      expect(line, line).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('picks from the table, and stays inside it', () => {
    expect(loadingTip(() => 0)).toBe(LOADING_TIPS[0]);
    expect(loadingTip(() => 0.999)).toBe(LOADING_TIPS[LOADING_TIPS.length - 1]);
  });
});