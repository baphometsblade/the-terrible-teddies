import { describe, expect, it } from 'vitest';
import { emptySlip, noteHeal, noteHit, notePlay, slipLine } from './turnSlip';

describe('turn slip', () => {
  it('reads a quiet round as a quiet round', () => {
    expect(slipLine(emptySlip())).toBe('Your round: hands stayed in your lap.');
  });

  it('tallies plays, damage, kills, face and healing in one line', () => {
    let slip = emptySlip();
    slip = notePlay(slip);
    slip = notePlay(slip);
    slip = noteHit(slip, { damage: 4, killed: true, face: 1 });
    slip = noteHeal(slip, 3);
    expect(slipLine(slip)).toBe('Your round: played 2, dealt 4, dropped 1, 1 on the mouth, patched 3.');
    expect(slipLine(slip).length).toBeLessThanOrEqual(80);
  });

  it('does not mutate the slip it is given', () => {
    const slip = emptySlip();
    notePlay(slip);
    noteHit(slip, { damage: 2, killed: true });
    expect(slip).toEqual(emptySlip());
  });
});
