import { describe, it, expect } from 'vitest';
import { CHUCK_TIPS, CHUCK_TIP_MAX, chuckTip } from './chuckTips';

describe('Chuck on the menu', () => {
  it('keeps every line short and without a shout', () => {
    expect(new Set(CHUCK_TIPS).size).toBe(CHUCK_TIPS.length);
    for (const line of CHUCK_TIPS) {
      expect(line.length, line).toBeLessThanOrEqual(CHUCK_TIP_MAX);
      expect(line, line).not.toMatch(/!/);
    }
  });

  it('picks from the night the player is actually having', () => {
    expect(chuckTip({ tutorialCompleted: false, totalBattles: 0 })).toMatch(/Sit down/);
    expect(chuckTip({ tutorialCompleted: true, totalBattles: 4, currentWinStreak: 3, coins: 500 })).toMatch(/winning/);
    expect(chuckTip({ tutorialCompleted: true, totalBattles: 2, coins: 10 })).toMatch(/Skint/);
    expect(chuckTip({
      tutorialCompleted: true, totalBattles: 2, coins: 400,
      unlockedCosmetics: [], equippedCardBack: 'house-back', equippedBoard: 'house-board',
    })).toMatch(/wardrobe/i);
    expect(chuckTip({
      tutorialCompleted: true, totalBattles: 2, coins: 400,
      unlockedCosmetics: ['velvet-rope'], equippedCardBack: 'velvet-rope', equippedBoard: 'house-board',
    })).toMatch(/came back/);
  });
});
