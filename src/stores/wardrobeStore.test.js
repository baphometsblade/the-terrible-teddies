import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, normalizeSave } from './gameStore';
import { DEFAULT_BOARD, DEFAULT_CARD_BACK } from '@/lib/wardrobe';

describe('wardrobe on the save', () => {
  beforeEach(() => {
    useGameStore.setState(normalizeSave({ coins: 500, gems: 40, unlockedCosmetics: [] }));
  });

  it('buys a coin back once, equips it, and will not charge again', () => {
    expect(useGameStore.getState().purchaseWardrobe('velvet-rope')).toBe('bought');
    expect(useGameStore.getState()).toMatchObject({
      coins: 100,
      equippedCardBack: 'velvet-rope',
      unlockedCosmetics: ['velvet-rope'],
    });
    expect(useGameStore.getState().purchaseWardrobe('velvet-rope')).toBe('owned');
    expect(useGameStore.getState().coins).toBe(100);
  });

  it('refuses a gem cloth the wallet cannot cover, and keeps an unknown id off the save', () => {
    useGameStore.setState({ gems: 10 });
    expect(useGameStore.getState().purchaseWardrobe('cold-open')).toBe('short');
    expect(useGameStore.getState().gems).toBe(10);
    expect(useGameStore.getState().purchaseWardrobe('not-a-look')).toBe('unknown');
  });

  it('repairs a broken look and keeps a bought one through a reset', () => {
    const fixed = normalizeSave({ equippedCardBack: 'nope', equippedBoard: 'red-room', unlockedCosmetics: ['red-room'] });
    expect(fixed.equippedCardBack).toBe(DEFAULT_CARD_BACK);
    expect(fixed.equippedBoard).toBe('red-room');
    useGameStore.setState({ unlockedCosmetics: ['brass-knuckles'], equippedCardBack: 'brass-knuckles', gems: 80 });
    useGameStore.getState().resetProgress();
    expect(useGameStore.getState().unlockedCosmetics).toContain('brass-knuckles');
    expect(useGameStore.getState().equippedCardBack).toBe('brass-knuckles');
    expect(useGameStore.getState().equippedBoard).toBe(DEFAULT_BOARD);
  });
});
