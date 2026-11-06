import { describe, it, expect } from 'vitest';
import { FIRST_FIGHT, firstFightStep } from './firstFight';

describe('first fight', () => {
  it('starts on Warming Up and moves to the first legal attack', () => {
    expect(firstFightStep({ armed: true, readyAttacker: false })).toBe('warming');
    expect(firstFightStep({ armed: true, readyAttacker: true })).toBe('attack');
  });

  it('stays quiet once the lesson is over, or when it was never armed', () => {
    expect(firstFightStep({ armed: false, readyAttacker: true })).toBeNull();
    expect(firstFightStep({ armed: false, readyAttacker: false })).toBeNull();
  });

  it('keeps both lines short enough for one row above the hand', () => {
    for (const step of Object.values(FIRST_FIGHT)) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(`${step.title}. ${step.body}`.length).toBeLessThanOrEqual(90);
    }
  });
});
