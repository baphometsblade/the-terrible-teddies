import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const confetti = vi.fn(() => Promise.resolve());
vi.mock('canvas-confetti', () => ({ default: (...args) => confetti(...args) }));

const { celebrate } = await import('./celebrate');
const { useGameStore } = await import('@/stores/gameStore');

describe('celebrate', () => {
  beforeEach(() => {
    confetti.mockClear();
    useGameStore.setState({ animationsEnabled: true });
  });

  it('fires with the caller\'s options and the reduced-motion opt-out', () => {
    celebrate({ particleCount: 80, spread: 70 });
    expect(confetti).toHaveBeenCalledTimes(1);
    expect(confetti).toHaveBeenCalledWith({ disableForReducedMotion: true, particleCount: 80, spread: 70 });
  });

  it('fires nothing when the player has turned Animations off', () => {
    useGameStore.setState({ animationsEnabled: false });
    expect(celebrate({ particleCount: 150 })).toBeNull();
    expect(confetti).not.toHaveBeenCalled();
  });
});

// The helper only works if nothing goes around it: one direct import and that
// screen's confetti ignores the Animations switch again — which is how every
// screen started out. Scans the source rather than trusting a list.
describe('canvas-confetti', () => {
  it('is imported by src/lib/celebrate.js and nothing else', () => {
    const root = join(__dirname, '..');
    const offenders = readdirSync(root, { recursive: true })
      .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f))
      .filter((f) => join(root, f) !== join(__dirname, 'celebrate.js'))
      .filter((f) => /from\s+['"]canvas-confetti['"]|require\(\s*['"]canvas-confetti['"]/.test(readFileSync(join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
