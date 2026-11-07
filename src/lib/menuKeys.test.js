import { describe, it, expect } from 'vitest';
import { neighborIndex } from './menuKeys';

// Eight tiles. Two columns on a phone, four from sm — the menu's own grid.
describe('menu arrow keys', () => {
  it('moves across and down a phone grid, and stops at the edge', () => {
    expect(neighborIndex(0, 'ArrowRight', 2, 8)).toBe(1);
    expect(neighborIndex(1, 'ArrowLeft', 2, 8)).toBe(0);
    expect(neighborIndex(0, 'ArrowLeft', 2, 8)).toBeNull();
    expect(neighborIndex(0, 'ArrowDown', 2, 8)).toBe(2);
    expect(neighborIndex(0, 'ArrowUp', 2, 8)).toBeNull();
    expect(neighborIndex(6, 'ArrowDown', 2, 8)).toBeNull();
    expect(neighborIndex(7, 'ArrowRight', 2, 8)).toBeNull();
  });

  it('uses four columns once the grid does', () => {
    expect(neighborIndex(0, 'ArrowRight', 4, 8)).toBe(1);
    expect(neighborIndex(3, 'ArrowRight', 4, 8)).toBeNull();
    expect(neighborIndex(0, 'ArrowDown', 4, 8)).toBe(4);
    expect(neighborIndex(4, 'ArrowDown', 4, 8)).toBeNull();
    expect(neighborIndex(5, 'ArrowUp', 4, 8)).toBe(1);
  });

  it('ignores anything that is not an arrow, and a tile that is not in the grid', () => {
    expect(neighborIndex(0, 'Enter', 2, 8)).toBeNull();
    expect(neighborIndex(0, 'Tab', 4, 8)).toBeNull();
    expect(neighborIndex(-1, 'ArrowRight', 2, 8)).toBeNull();
    expect(neighborIndex(8, 'ArrowLeft', 2, 8)).toBeNull();
    expect(neighborIndex(0, 'ArrowRight', 0, 8)).toBeNull();
  });
});
