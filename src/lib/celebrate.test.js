import { describe, it, expect, vi, beforeEach } from 'vitest';

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
