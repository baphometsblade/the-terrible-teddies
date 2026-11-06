import { describe, it, expect } from 'vitest';
import { ALL_CARDS } from '@/stores/gameStore';
import { simulateGame, mulberry32 } from './battleSim';

const byName = (name) => ALL_CARDS.find((c) => c.name === name);

describe('battle sim', () => {
  it('ends, and a stack of legends beats a stack of runts', () => {
    const legend = byName('Big Spoon, Last Warning');
    const runt = byName('Bar-Fight Barry');
    const random = mulberry32(7);
    let wins = 0;
    for (let i = 0; i < 20; i += 1) {
      const result = simulateGame(
        Array.from({ length: 8 }, () => legend),
        Array.from({ length: 8 }, () => runt),
        random,
      );
      expect(['a', 'b', 'draw']).toContain(result);
      if (result === 'a') wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(14);
  });
});
