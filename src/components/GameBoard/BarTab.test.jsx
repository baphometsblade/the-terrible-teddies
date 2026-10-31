import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BarTab, { REWARD_BEATS } from './BarTab';
import { useGameStore } from '@/stores/gameStore';
import { TAB_COPY } from '@/lib/houseLines';
import { rankUp } from '@/lib/houseRank';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const baseRewards = {
  xp: 20,
  coins: 5,
  progress: null,
  tierBefore: 0,
  tierAfter: 0,
  stats: { cardsPlayed: 7, damageDealt: 31, healingDone: 4, damageTaken: 12 },
};
const levelProgress = {
  xpBefore: 95, xpNeededBefore: 100, xpAfter: 15, xpNeededAfter: 150, levelAfter: 2, levelsGained: 1, bonusCoins: 200,
};

async function renderTab(rewards = baseRewards, footer = 'Gratuity not included. Neither is dignity.') {
  await act(async () => { root.render(<BarTab rewards={rewards} footer={footer} />); });
}

// The receipt's rows as a screen reader meets them: each <dt> and the <dd>
// that follows it, with the figure as text (the leader and the count-up's
// passing numbers are aria-hidden and not part of what is said).
const spoken = (node) => {
  const clone = node.cloneNode(true);
  clone.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
  return clone.textContent.trim();
};
const rows = () => Object.fromEntries(
  [...container.querySelectorAll('dl > div')].map((row) => [
    row.querySelector('dt').textContent,
    spoken(row.querySelector('dd')),
  ]),
);

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('BarTab', () => {
  it('keeps "Battle Rewards" as visible text, under a large title that is for the eye alone', async () => {
    await renderTab();
    const group = container.querySelector('[role="group"]');
    const header = [...group.querySelectorAll('div')].find((el) => el.textContent === TAB_COPY.header);
    expect(header, 'e2e/smoke.spec.js finds the rewards by this text').toBeTruthy();
    expect(header.closest('[aria-hidden="true"]')).toBeNull();
    expect(group.getAttribute('aria-labelledby')).toBe(header.id);
    const title = [...group.querySelectorAll('p')].find((el) => el.textContent === TAB_COPY.title);
    expect(title.getAttribute('aria-hidden')).toBe('true');
  });

  it('itemizes the night as a definition list, so a screen reader hears "Damage dealt, 31"', async () => {
    await renderTab();
    expect(container.querySelectorAll('dl').length).toBeGreaterThan(0);
    expect(rows()).toMatchObject({
      [TAB_COPY.cards]: '7',
      [TAB_COPY.damage]: '31',
      [TAB_COPY.healed]: '4',
      [TAB_COPY.taken]: '12',
    });
    // Every <dt> is followed by its <dd>, inside the row, never loose in the list.
    for (const dl of container.querySelectorAll('dl')) {
      for (const child of dl.children) {
        expect(child.tagName).toBe('DIV');
        expect([...child.children].map((el) => el.tagName).slice(0, 2)).toEqual(['DT', 'DD']);
      }
    }
  });

  it('says the final XP and coins in text from the start, and counts only for the eye', async () => {
    await renderTab();
    expect(rows()[TAB_COPY.xp]).toBe('20 XP');
    expect(rows()[TAB_COPY.coins]).toBe('5 coins');
    // The first count-up on the receipt is the XP, which e2e/board.spec.js reads.
    const counts = [...container.querySelectorAll('[data-count-up]')];
    expect(counts.map((el) => el.getAttribute('aria-hidden'))).toEqual(['true', 'true']);
    expect(REWARD_BEATS.xp).toBeLessThan(REWARD_BEATS.coins);
  });

  it('prints Chuck\'s running tab from the store\'s all-time damage, with his name and what it says', async () => {
    useGameStore.setState({ totalDamageDealt: 4812 });
    await renderTab();
    expect(rows()[TAB_COPY.chuck]).toBe('4,812 damage, still open');
    expect(container.textContent).toContain(TAB_COPY.chuck);
    expect(container.textContent).toContain(TAB_COPY.chuckStatus);
    // It follows the store: a bigger bill reads bigger.
    await act(async () => { useGameStore.setState({ totalDamageDealt: 50000 }); });
    expect(rows()[TAB_COPY.chuck]).toBe('50,000 damage, still open');
  });

  it('prints the footer it was given, and none when it was given none', async () => {
    await renderTab(baseRewards, 'Tip your bartender. She saw everything.');
    expect(container.textContent).toContain('Tip your bartender. She saw everything.');
    await renderTab(baseRewards, null);
    expect(container.textContent).not.toContain('Tip your bartender');
  });

  it('shows the level bar, the level-up and the Battle Pass tier only when there is one', async () => {
    await renderTab();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('[data-level-up]')).toBeNull();
    expect(container.querySelector('[data-pass-tier]')).toBeNull();

    await renderTab({ ...baseRewards, progress: levelProgress, tierBefore: 1, tierAfter: 2 });
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-label')).toBe('Level 2: 15 of 150 XP');
    expect(bar.getAttribute('aria-valuenow')).toBe('15');
    expect(container.querySelector('[data-level-up]').textContent).toContain('Level 2');
    expect(container.querySelector('[data-level-up]').textContent).toContain('+200');
    expect(container.querySelector('[data-pass-tier]').textContent).toBe('Battle Pass tier 2 unlocked');

    // Level 1 to 2 stays on the first rung: no promotion line.
    expect(container.querySelector('[data-rank-up]')).toBeNull();

    // A level-up that crosses a house rank prints the promotion, once, under the bonus.
    await renderTab({
      ...baseRewards, progress: { ...levelProgress, levelBefore: 4, levelAfter: 5 }, tierBefore: 1, tierAfter: 1,
    });
    const promoted = container.querySelectorAll('[data-rank-up]');
    expect(promoted).toHaveLength(1);
    expect(promoted[0].textContent).toBe(rankUp(4, 5).promoted);
    expect(container.querySelector('[data-level-up]').contains(promoted[0])).toBe(true);

    // A battle that gained XP but no level and opened no tier: the bar, and nothing else.
    await renderTab({ ...baseRewards, progress: { ...levelProgress, levelsGained: 0 }, tierBefore: 2, tierAfter: 2 });
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.querySelector('[data-level-up]')).toBeNull();
    expect(container.querySelector('[data-pass-tier]')).toBeNull();
  });

  // A short screen keeps Play Again within reach by dropping the four itemized
  // rows from sight below 700px tall. They go to the screen-reader-only style,
  // not display:none, so what the receipt says is the same on every screen.
  // (jsdom has no media queries: the class is the pin, e2e/board.spec.js is the
  // measure.)
  it('hands the four itemized rows to screen readers alone on a short screen, and no other row', async () => {
    await renderTab();
    const SHORT = '[@media(max-height:700px)]:sr-only';
    const byLabel = Object.fromEntries([...container.querySelectorAll('dl > div')].map((row) => [row.querySelector('dt').textContent, row]));
    for (const label of [TAB_COPY.cards, TAB_COPY.damage, TAB_COPY.healed, TAB_COPY.taken]) {
      expect(byLabel[label].className, label).toContain(SHORT);
    }
    for (const label of [TAB_COPY.xp, TAB_COPY.coins, TAB_COPY.chuck]) {
      expect(byLabel[label].className, label).not.toContain(SHORT);
    }
  });

  it('reads a battle with no figures (a result with nothing recorded) as zeros, not blanks', async () => {
    await renderTab({ ...baseRewards, stats: undefined });
    expect(rows()).toMatchObject({
      [TAB_COPY.cards]: '0', [TAB_COPY.damage]: '0', [TAB_COPY.healed]: '0', [TAB_COPY.taken]: '0',
    });
  });

  it('is the material in the slot the stylesheet draws, with the paper\'s ink from the material', async () => {
    await renderTab();
    expect(container.querySelector('.receipt-feed .receipt.receipt-print')).not.toBeNull();
    // The small print is the material's faded ink, never a Tailwind colour
    // that was measured on a dark panel (plush-300 on cream is about 2:1).
    const header = container.querySelector('[role="group"] .label-caps');
    expect(header.className).toContain('var(--receipt-faded)');
    expect(header.className).not.toMatch(/text-(plush|brass|white)/);
  });
});
