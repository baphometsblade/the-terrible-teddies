import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readingTime } from '@/components/ui/use-toast';
import { HOUSE_RANKS, RANK_PROMOTED_MAX } from './houseRank';
import { levelUpToast } from './levelUpToast';

// The level-up announcement App raises for a level earned away from the
// result screen. Rendered to a real DOM, so what a screen reader reads (the
// text, sr-only words and all) is what is checked.
const dom = (node) => {
  const el = document.createElement('div');
  el.innerHTML = renderToStaticMarkup(<>{node}</>);
  return el;
};
const spoken = (toast) => dom(toast.description).textContent;
const lastRung = HOUSE_RANKS[HOUSE_RANKS.length - 1];

describe('a level-up that stays on its rung', () => {
  // The words a level-up has always had. A rank must not change them.
  it('says what it always said: the level, and the bonus with its coin', () => {
    const toast = levelUpToast({ level: 2, levelsGained: 1, bonusCoins: 200 });
    expect(toast.title).toBe('Level 2!');
    expect(spoken(toast)).toBe('Level-up bonus: +200 coins');
    expect(dom(toast.description).querySelector('[data-rank-up]')).toBeNull();
    expect(toast.duration).toBe(readingTime('Level 2!', 'Level-up bonus: +200 coins'));
  });

  it('adds nothing for a jump that stays inside a rung', () => {
    const toast = levelUpToast({ level: HOUSE_RANKS[1].min - 1, levelsGained: HOUSE_RANKS[1].min - 2, bonusCoins: 700 });
    expect(dom(toast.description).querySelector('[data-rank-up]')).toBeNull();
  });
});

describe('a level-up that reaches a rung', () => {
  it.each(HOUSE_RANKS.slice(1).map((row) => [row.name, row]))('says %s once, under the bonus, as the table has it', (_name, row) => {
    const bonusCoins = 100 * row.min;
    const toast = levelUpToast({ level: row.min, levelsGained: 1, bonusCoins });
    const line = dom(toast.description).querySelector('[data-rank-up]');
    expect(line, `no promotion line for ${row.name}`).not.toBeNull();
    // The line exactly as the table has it: nothing wrapped around it.
    expect(line.textContent).toBe(row.promoted);
    expect(dom(toast.description).querySelectorAll('[data-rank-up]')).toHaveLength(1);
    // What a screen reader hears: the bonus is a sentence of its own, then the line.
    expect(spoken(toast)).toBe(`Bonus: +${bonusCoins.toLocaleString()} coins. ${row.promoted}`);
  });

  // On a 360px phone the medallion is back and the description is 162px wide:
  // "Level-up bonus: +1,000" takes two lines there, and the rank's line makes
  // three, which reaches the controls under a dialog's header. The shorter
  // label keeps the bonus on one line; a level-up with no rank keeps its own.
  it('says "Bonus:" rather than "Level-up bonus:", and only when it has a line to carry', () => {
    const withRank = levelUpToast({ level: HOUSE_RANKS[2].min, levelsGained: 1, bonusCoins: 1000 });
    expect(spoken(withRank)).toMatch(/^Bonus: \+1,000 coins\. /);
    expect(spoken(withRank)).not.toContain('Level-up bonus');
    const plain = levelUpToast({ level: HOUSE_RANKS[2].min + 1, levelsGained: 1, bonusCoins: 1100 });
    expect(spoken(plain)).toBe('Level-up bonus: +1,100 coins');
  });

  it('keeps the title "Level N!": the rank is not in it', () => {
    for (const row of HOUSE_RANKS.slice(1)) {
      const { title } = levelUpToast({ level: row.min, levelsGained: 1, bonusCoins: 100 * row.min });
      expect(title).toBe(`Level ${row.min}!`);
    }
  });

  it('puts the line on a row of its own, after the bonus', () => {
    const toast = levelUpToast({ level: HOUSE_RANKS[1].min, levelsGained: 1, bonusCoins: 500 });
    const root = dom(toast.description);
    const line = root.querySelector('[data-rank-up]');
    expect(line.className).toContain('block');
    // After the bonus (and its coin), not before or inside it.
    expect(root.querySelector('.whitespace-nowrap').compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(root.querySelector('.whitespace-nowrap').contains(line)).toBe(false);
  });

  it('says one promotion for a jump over several rungs, the highest, starting from the level it started on', () => {
    const toast = levelUpToast({ level: lastRung.min, levelsGained: lastRung.min - 1, bonusCoins: 123456 });
    expect(dom(toast.description).querySelector('[data-rank-up]').textContent).toBe(lastRung.promoted);
    expect(dom(toast.description).querySelectorAll('[data-rank-up]')).toHaveLength(1);
  });

  // The entry holds the level it arrived at and how many it gained, so a jump
  // that crosses a threshold and carries on into the rung still promotes: the
  // level it ends on alone would not say so.
  it('promotes a jump that crosses a threshold and ends inside the rung', () => {
    const rung = HOUSE_RANKS[1];
    const toast = levelUpToast({ level: rung.min + 2, levelsGained: 3, bonusCoins: 2100 });
    expect(dom(toast.description).querySelector('[data-rank-up]').textContent).toBe(rung.promoted);
    // ...and the same level reached from inside the rung does not.
    const inside = levelUpToast({ level: rung.min + 2, levelsGained: 1, bonusCoins: 700 });
    expect(dom(inside.description).querySelector('[data-rank-up]')).toBeNull();
  });

  it('treats an entry with no levelsGained as one level', () => {
    const reached = levelUpToast({ level: HOUSE_RANKS[1].min, bonusCoins: 500 });
    expect(dom(reached.description).querySelector('[data-rank-up]').textContent).toBe(HOUSE_RANKS[1].promoted);
    const inside = levelUpToast({ level: HOUSE_RANKS[1].min + 1, bonusCoins: 600 });
    expect(dom(inside.description).querySelector('[data-rank-up]')).toBeNull();
  });

  it('is read for as long as the words a screen reader hears', () => {
    const row = HOUSE_RANKS[1];
    const toast = levelUpToast({ level: row.min, levelsGained: 1, bonusCoins: 500 });
    expect(toast.duration).toBe(readingTime(`Level ${row.min}!`, spoken(toast)));
  });

  // The ranks' own lines are short enough to sit under reading time's floor,
  // so a long one is stood in for them: the time has to grow with the words.
  describe('with a long promotion line', () => {
    afterEach(() => {
      vi.doUnmock('./houseRank');
      vi.resetModules();
    });

    it('counts the line in its reading time', async () => {
      vi.resetModules();
      vi.doMock('./houseRank', () => ({ rankUp: () => ({ promoted: 'a line that takes a good while to read. '.repeat(4).trim() }) }));
      const { levelUpToast: stoodIn } = await import('./levelUpToast');
      const toast = stoodIn({ level: 5, levelsGained: 1, bonusCoins: 500 });
      expect(toast.duration).toBeGreaterThan(readingTime('Level 5!', 'Level-up bonus: +500 coins'));
      expect(toast.duration).toBe(readingTime('Level 5!', spoken(toast)));
    });
  });

  // The slot: the bonus takes the first of the description's two lines over a
  // dialog, so the line itself has to fit one.
  it('holds a line no longer than the slot', () => {
    for (const row of HOUSE_RANKS.slice(1)) {
      const { description } = levelUpToast({ level: row.min, levelsGained: 1, bonusCoins: 100 * row.min });
      expect(dom(description).querySelector('[data-rank-up]').textContent.length).toBeLessThanOrEqual(RANK_PROMOTED_MAX);
    }
  });
});
