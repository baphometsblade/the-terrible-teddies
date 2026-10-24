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

  // resetProgress keeps the cloud save's bookkeeping (cloudRev and the synced
  // fingerprint) precisely so that the reset reaches the account as an
  // ordinary change, and cloudSave.test.js pins that it is sent. So while the
  // account keeps this save, the confirmation has to say the account resets
  // too; it said only "can't be undone".
  it('says the account resets too while the cloud save is on, and only then', () => {
    useGameStore.setState({ level: 6, cloudRev: 4, cloudSyncedHash: 'synced', cloudSyncedAt: 1 });
    const line = describeReset(get(), NOW, { onAccount: true }).account;
    expect(line).toBe('This resets the save on your account too, not just on this device.');
    expect(describeReset(get(), NOW, { onAccount: false }).account).toBeNull();
    expect(describeReset(get(), NOW).account).toBeNull();
    // What makes the line true: the reset goes out from the rev this device
    // was in step with, as a change, not as a save never synced.
    get().resetProgress();
    expect([get().cloudRev, get().cloudSyncedHash, get().level]).toEqual([4, 'synced', 1]);
  });

  // keptThroughReset carries gems owed after a reversed payment and gives no
  // starting gems against them, so "0 gems, the starting amount" was false.
  it('names gems owed as kept, not a starting balance it does not give', () => {
    useGameStore.setState({ gems: 0, gemDebt: 540 });
    expect(describeReset(get(), NOW).keeps[0]).toBe('540 gems owed after a reversed payment');
    useGameStore.getState().resetProgress();
    expect([get().gems, get().gemDebt]).toEqual([0, 540]);
  });

  it('names what goes, and what each thing goes back to', () => {
    useGameStore.setState({
      level: 7, coins: 2345, ownedCards: Array.from({ length: 48 }, (_, i) => i + 1),
      savedDecks: [{}, {}, {}], cardPacks: 4, seasonXP: 3250,
    });
    const labels = describeReset(get(), NOW).deletes.map((d) => [d.label, d.after]);
    expect(labels).toEqual([
      ['Level 7', 'back to Level 1'],
      ['48 cards', `back to the ${FRESH_START.cardIds.length} starters`],
      ['3 saved decks', undefined],
      ['2,345 coins', `back to ${FRESH_START.coins}`],
      ['4 card packs', `back to ${FRESH_START.cardPacks}`],
      ['3,250 Battle Pass XP', undefined],
      ['Stats, achievements, login streak and challenge progress', undefined],
      ['Your name, sound, animation and difficulty settings', 'back to defaults'],
    ]);
  });

  // resetProgress brings tutorialCompleted back to false, and App reopens
  // the tutorial after the reset; the confirmation did not say so.
  it('says the tutorial is shown again, when it has been completed', () => {
    useGameStore.setState({ tutorialCompleted: true });
    expect(describeReset(get(), NOW).deletes).toContainEqual({ label: 'Tutorial completed', after: 'shown again' });
    useGameStore.getState().resetProgress();
    expect(get().tutorialCompleted).toBe(false);
  });

  it('lists only what the reset changes', () => {
    // A fresh save: nothing of its own to lose but the stats and settings.
    expect(describeReset(get(), NOW).deletes.map((d) => d.label)).toEqual([
      'Stats, achievements, login streak and challenge progress',
      'Your name, sound, animation and difficulty settings',
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
