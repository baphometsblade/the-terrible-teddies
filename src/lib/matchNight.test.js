import { describe, expect, it } from 'vitest';
import { mvpLine, pickMvp, pushRecap, tallyMvp } from './matchNight';

describe('the night recap and the MVP', () => {
  it('keeps the last 24 lines and crowns the hardest swing', () => {
    let lines = [];
    for (let i = 0; i < 30; i += 1) lines = pushRecap(lines, `line ${i}`);
    expect(lines).toHaveLength(24);
    expect(lines[0]).toBe('line 6');

    let tally = {};
    tally = tallyMvp(tally, { id: 'a', name: 'Sid', damage: 2 });
    tally = tallyMvp(tally, { id: 'b', name: 'Hank', damage: 5 });
    tally = tallyMvp(tally, { id: 'a', name: 'Sid', damage: 4 });
    expect(pickMvp(tally).name).toBe('Sid');
    expect(pickMvp(tally).damage).toBe(6);
    expect(mvpLine(pickMvp(tally))).toBe('MVP: Sid, 6 on the night.');
    expect(mvpLine(null)).toMatch(/polite/);
    expect(pickMvp({})).toBeNull();
  });
});
