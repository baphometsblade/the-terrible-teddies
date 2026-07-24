import { QUIPS, pickQuip, OPPONENT_NAME } from './teddyTalk';

describe('teddyTalk', () => {
  it('has a named opponent persona', () => {
    expect(OPPONENT_NAME).toBeTruthy();
  });

  it('every pool is a non-empty array of non-empty strings', () => {
    const pools = Object.keys(QUIPS);
    expect(pools.length).toBeGreaterThan(0);
    for (const pool of pools) {
      expect(QUIPS[pool].length).toBeGreaterThan(0);
      for (const line of QUIPS[pool]) {
        expect(typeof line).toBe('string');
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('picks from the requested pool', () => {
    for (let i = 0; i < 20; i++) {
      expect(QUIPS.oppKills).toContain(pickQuip('oppKills'));
    }
  });

  it('never repeats the previous quip back to back', () => {
    let last = pickQuip('oppWins');
    for (let i = 0; i < 50; i++) {
      const next = pickQuip('oppWins', last);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('returns null for an unknown pool instead of crashing', () => {
    expect(pickQuip('nonexistent')).toBeNull();
  });
});
