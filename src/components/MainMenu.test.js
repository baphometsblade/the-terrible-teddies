import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { BATTLE_PASS_REWARDS, countReadyRewards } from '@/lib/battlePass';
import { getCurrentSeason } from '@/utils/season';
import MainMenu from './MainMenu';
import BattlePass from './BattlePass';

// The Battle Pass tile was hard-coded to the brass trim the menu reserves for
// "asking for attention", with no badge, so it stayed lit with every tier
// claimed. It now badges the live count, from the helper the pass uses.

let mounted = [];
const render = (Component, props = {}) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  MotionGlobalConfig.skipAnimations = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(Component, { onClose() {}, ...props })));
  mounted.push({ host, root });
  return host;
};
const passTile = (host) => [...host.querySelectorAll('[role="button"]')].find((el) => el.textContent.startsWith('Battle Pass'));
const passChip = (host) => [...host.querySelectorAll('span')].find((el) => /^\d+ ready$/.test(el.textContent))?.textContent ?? null;

beforeEach(() => {
  localStorage.clear();
  // A clean store, not resetProgress: a reset keeps gems, packs, the pass and
  // the claim ledgers, which would leak from one test into the next.
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({
    seasonKey: getCurrentSeason().key, seasonXP: 0, claimedBattlePassRewards: { free: [], premium: [] },
    hasBattlePassPremium: false, animationsEnabled: false, lastLoginDate: new Date().toDateString(),
  });
});
afterEach(() => {
  for (const { host, root } of mounted) {
    act(() => root.unmount());
    host.remove();
  }
  mounted = [];
  MotionGlobalConfig.skipAnimations = false;
});

describe('the Battle Pass menu tile', () => {
  const cases = [
    ['nothing reached but tier 1', { seasonXP: 0 }],
    ['a few tiers, free track', { seasonXP: 1400, claimedBattlePassRewards: { free: [1, 2], premium: [] } }],
    ['with the pass', { seasonXP: 1400, hasBattlePassPremium: true, claimedBattlePassRewards: { free: [1], premium: [3] } }],
  ];
  for (const [name, state] of cases) {
    it(`badges the same count the pass does: ${name}`, () => {
      useGameStore.setState(state);
      const s = useGameStore.getState();
      const n = countReadyRewards({ seasonXP: s.seasonXP, claimed: s.claimedBattlePassRewards, hasPremium: s.hasBattlePassPremium });
      expect(n).toBeGreaterThan(0);
      const tile = passTile(render(MainMenu));
      expect(tile.className).toContain('trim-brass');
      expect(document.getElementById(tile.getAttribute('aria-describedby')).textContent).toBe(`${n} ready`);
      expect(passChip(render(BattlePass))).toBe(`${n} ready`);
    });
  }

  it('goes quiet once everything reached is claimed', () => {
    const tiers = BATTLE_PASS_REWARDS.map((r) => r.tier);
    useGameStore.setState({ seasonXP: 1e9, claimedBattlePassRewards: { free: tiers, premium: [] } });
    const tile = passTile(render(MainMenu));
    expect(tile.className).not.toContain('trim-brass');
    expect(tile.hasAttribute('aria-describedby')).toBe(false);
    expect(passChip(render(BattlePass))).toBeNull();
  });

  // A save from an ended season: the menu rolls it over before counting,
  // rather than badging tiers the pass would deliver the moment it opened.
  it('counts this season, not the save’s ended one', () => {
    useGameStore.setState({ seasonKey: `season-${getCurrentSeason().number - 1}`, seasonXP: 1e9 });
    const tile = passTile(render(MainMenu));
    expect(useGameStore.getState().seasonKey).toBe(getCurrentSeason().key);
    expect(document.getElementById(tile.getAttribute('aria-describedby')).textContent).toBe('1 ready');
  });
});

// With gems owed after a reversed payment the balance is 0, and the menu
// said "0" while the stores' wallets said what was owed: to a buyer whose
// purchase had just paid that debt, "0" read as gems that never arrived.
describe('the menu gem balance', () => {
  const gemChip = (host) => [...host.querySelectorAll('header .sr-only')].find((el) => /gems/.test(el.textContent))?.parentElement;

  it('shows gems owed as owed, and the balance otherwise', () => {
    useGameStore.setState({ gems: 0, gemDebt: 540 });
    expect(gemChip(render(MainMenu)).textContent).toBe('−540gems owed after a reversed payment');
    useGameStore.setState({ gems: 1250, gemDebt: 0 });
    expect(gemChip(render(MainMenu)).textContent).toBe('1,250gems');
  });
});
