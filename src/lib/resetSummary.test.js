import { beforeEach, describe, it, expect } from 'vitest';
import { describeReset } from './resetSummary';
import { useGameStore, FRESH_START } from '@/stores/gameStore';
import { getCurrentSeason, getSeason } from '@/utils/season';

const get = () => useGameStore.getState();
const NOW = new Date('2026-11-02T12:00:00Z'); // Season 3

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe('the reset confirmation', () => {
  // It said only "This will delete ALL progress". It now names what goes and
  // what stays, in the player's own numbers.
  it('names a buyer\'s gems, Premium Pass, packs and doubler as kept, with the real numbers', () => {
    useGameStore.setState({
      gems: 3010, seasonKey: getCurrentSeason(NOW).key, hasBattlePassPremium: true,
      premiumPacks: 2, legendaryPacks: 1, coinDoublerExpiresAt: NOW.getTime() + 5 * 3_600_000 - 1,
      unlockedCosmetics: ['Golden Stitch Border'],
    });
    const { keeps } = describeReset(get(), NOW);
    expect(keeps).toEqual([
      '3,010 gems',
      `Premium Pass for ${getCurrentSeason(NOW).name}`,
      '2 Premium and 1 Legendary packs, unopened',
      'Coin Doubler, 5h left',
      '1 cosmetic',
    ]);
  });

  it('names what goes, and what each thing goes back to', () => {
    useGameStore.setState({
      level: 7, coins: 2345, ownedCards: Array.from({ length: 48 }, (_, i) => i + 1),
      savedDecks: [{}, {}, {}], cardPacks: 4, seasonXP: 3250,
    });
    const labels = describeReset(get(), NOW).deletes.map((d) => [d.label, d.after]);
    expect(labels).toEqual([
      ['Level 7', 'back to Level 1'],
      ['48 cards and 3 saved decks', `back to the ${FRESH_START.cards} starters`],
      ['2,345 coins', `back to ${FRESH_START.coins}`],
      ['4 card packs', `back to ${FRESH_START.cardPacks}`],
      ['3,250 Battle Pass XP', undefined],
      ['Stats, achievements, login streak and challenge progress', undefined],
      ['Your name, sound, animation and difficulty settings', 'back to defaults'],
    ]);
  });

  it('does not promise a pass from a season that is over', () => {
    useGameStore.setState({ seasonKey: getSeason(1).key, hasBattlePassPremium: true });
    expect(describeReset(get(), NOW).keeps.join(' ')).not.toMatch(/Premium Pass/);
  });

  it('says a balance under the starting amount is topped up, not kept', () => {
    useGameStore.setState({ gems: 3 });
    expect(describeReset(get(), NOW).keeps[0]).toBe(`${FRESH_START.gems} gems, the starting amount`);
  });
});
