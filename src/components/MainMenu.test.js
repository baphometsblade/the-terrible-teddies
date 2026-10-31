import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// The bar's clock (src/lib/barClock.js): the sign in the hero and the Battle
// button's line both follow the hour on the player's own clock.
describe('the bar clock on the menu', () => {
  const named = (host) => [...host.querySelectorAll('[role="button"]')].find((el) => el.getAttribute('aria-label') === 'Battle');
  const battleLine = (host) => host.querySelector('#menu-battle-line')?.textContent;
  const sign = (host) => host.querySelector('.neon');
  const setHour = (hour, minute = 30) => vi.setSystemTime(new Date(2026, 9, 31, hour, minute));
  // Only Date is faked: the clock is read through it, and nothing else in the
  // menu's render should be touched.
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  const visibility = (state) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  };

  const NIGHT = [
    [10, 'OPEN EARLY', 'amber', "Chuck's still here."],
    [13, 'OPEN', 'amber', "Go make Chuck cry"],
    [17, 'HAPPY HOUR', 'pink', 'Happy hour. Ruin it.'],
    [22, 'OPEN LATE', 'teal', "Chuck's three deep."],
    [1, 'LAST CALL', 'pink', 'Chuck never left.'],
    [3, 'CLOSED', 'red', 'Chuck never left.'],
  ];
  it.each(NIGHT)('at %i:30 the sign says %s in %s and the Battle line is "%s"', (hour, text, tone, line) => {
    setHour(hour);
    const host = render(MainMenu);
    expect(sign(host).textContent).toBe(text);
    expect(sign(host).getAttribute('data-tone')).toBe(tone);
    expect(battleLine(host)).toBe(line);
  });

  it('flickers at last call and nowhere else, and tapes a note under the closed sign', () => {
    setHour(1);
    expect(sign(render(MainMenu)).hasAttribute('data-flicker')).toBe(true);
    setHour(3);
    const closed = render(MainMenu);
    expect(sign(closed).hasAttribute('data-flicker')).toBe(false);
    expect(sign(closed).getAttribute('data-lit')).toBe('half');
    expect(closed.querySelector('.note-taped').textContent).toBe('Come in anyway. — Mgmt.');
    for (const hour of [10, 13, 17, 22]) {
      setHour(hour);
      const host = render(MainMenu);
      expect(sign(host).hasAttribute('data-flicker'), `hour ${hour}`).toBe(false);
      expect(host.querySelector('.note-taped'), `hour ${hour}`).toBeNull();
    }
  });

  // The control is still "Battle" to everything that finds it; the clock's
  // line is its description, so a screen reader hears it too.
  it('keeps the control named Battle, and describes it with the line', () => {
    setHour(22);
    const host = render(MainMenu);
    const control = named(host);
    expect(control).toBeTruthy();
    expect(document.getElementById(control.getAttribute('aria-describedby')).textContent).toBe("Chuck's three deep.");
  });

  // The sign is a decoration: nothing about it is read or reached, it is only
  // drawn from md up (the tube alone, and only on a tall screen, below lg,
  // where the title leaves little of the corner free), and it is placed
  // absolutely, so it takes no layout (e2e/responsive.spec.js measures the
  // Battle button staying above the fold).
  it('is decoration: hidden from assistive tech, not a control, and out of the layout', () => {
    setHour(3);
    const host = render(MainMenu);
    const root = sign(host).closest('[aria-hidden="true"]');
    expect(root).not.toBeNull();
    expect(root.contains(host.querySelector('.note-taped'))).toBe(true);
    expect(root.querySelector('button, a[href], input, [tabindex]')).toBeNull();
    const classes = root.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['hidden', 'lg:block', 'absolute', 'pointer-events-none']));
    // Changed on purpose: the sign is drawn from lg only (a tube under the gear
    // at tablet width read as a label, not a sign; e2e/responsive.spec.js), so
    // the old md/short-screen rules and the note's own max-lg rule are gone.
    expect(classes).not.toContain('md:block');
    // Inside the hero, which is what it is positioned against.
    expect(root.parentElement.className).toContain('relative');
    expect(root.parentElement.querySelector('h1').textContent).toBe('Terrible Teddies');
  });

  it('reads the clock when the menu opens, and again when the tab comes back, and never on a timer', () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    setHour(17);
    const host = render(MainMenu);
    expect(battleLine(host)).toBe('Happy hour. Ruin it.');

    // Time moves on while the menu sits open: nothing is polling, so nothing
    // changes until the player looks again.
    setHour(22);
    expect(battleLine(host)).toBe('Happy hour. Ruin it.');
    expect(sign(host).textContent).toBe('HAPPY HOUR');

    // Coming back to the tab re-reads it, and the sign is drawn afresh.
    const before = sign(host);
    visibility('visible');
    expect(battleLine(host)).toBe("Chuck's three deep.");
    expect(sign(host).textContent).toBe('OPEN LATE');
    expect(sign(host)).not.toBe(before);
    expect(interval).not.toHaveBeenCalled();
  });

  it('does not re-read while the tab is hidden', () => {
    setHour(17);
    const host = render(MainMenu);
    setHour(22);
    visibility('hidden');
    expect(battleLine(host)).toBe('Happy hour. Ruin it.');
  });

  // Back in the same part of the night, nothing is replaced: the sign is not
  // switched on again for nothing.
  it('leaves the sign alone when the tab comes back in the same part of the night', () => {
    setHour(17, 5);
    const host = render(MainMenu);
    const before = sign(host);
    setHour(18, 45);
    visibility('visible');
    expect(sign(host)).toBe(before);
    expect(battleLine(host)).toBe('Happy hour. Ruin it.');
  });

  it('stops listening when the menu goes', () => {
    setHour(17);
    const remove = vi.spyOn(document, 'removeEventListener');
    render(MainMenu);
    act(() => { mounted.pop().root.unmount(); });
    expect(remove.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(true);
  });
});
