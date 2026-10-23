import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import CardPackOpening from './CardPackOpening';
import { BATTLE_PASS_REWARDS } from '@/lib/battlePass';
import { useGameStore, SHOP_ITEMS, DAILY_REWARDS } from '@/stores/gameStore';
import { getCurrentSeason } from '@/utils/season';

// The empty table used to say "No packs available. Buy some below!" over a
// shop whose every tile was greyed out, and named no way to earn a pack. It
// now names the real sources with the real numbers, each derived here from
// the table that grants it, and offers the purchase when one is affordable.
const cheapest = SHOP_ITEMS.filter((i) => i.type === 'pack' && i.currency === 'coins')
  .reduce((a, b) => (a.price <= b.price ? a : b));
const firstPassPack = BATTLE_PASS_REWARDS.find((r) => r.free?.type === 'pack');
const firstDailyPack = DAILY_REWARDS.findIndex((r) => r.packs > 0) + 1;

let host;
let root;
const render = (props = {}) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(CardPackOpening, { onClose() {}, ...props })));
  return host;
};
const buttonNamed = (name) => [...host.querySelectorAll('button')].find((b) => b.textContent === name);
const text = () => host.textContent.replace(/\s+/g, ' ');

beforeEach(() => {
  localStorage.clear();
  // A clean store, not resetProgress: a reset keeps gems, packs, the pass and
  // the claim ledgers, which would leak from one test into the next.
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({
    cardPacks: 0, premiumPacks: 0, legendaryPacks: 0, gems: 0,
    // A save stamped with this season: the panel rolls an older one over.
    seasonKey: getCurrentSeason().key, seasonXP: 0, claimedBattlePassRewards: { free: [], premium: [] },
    consecutiveLogins: 1, lastLoginDate: new Date().toDateString(),
    // celebrate() skips confetti with Animations off; jsdom has no canvas.
    animationsEnabled: false,
  });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe('the empty Card Packs table', () => {
  it('names where the next pack comes from, with real numbers', () => {
    useGameStore.setState({ coins: 50 });
    render();
    expect(text()).not.toContain('No packs available');
    expect(text()).toContain(`${cheapest.name} · ${cheapest.price} coins`);
    expect(text()).toContain(`${cheapest.price - 50} more coins`);
    const bar = host.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe(String(Math.round((50 / cheapest.price) * 100)));
    expect(text()).toContain(`Battle Pass tier ${firstPassPack.tier} · ${firstPassPack.free.amount} pack`);
    expect(text()).toContain(`${firstPassPack.xpRequired} XP to go`);
    // Claimed today on streak day 1: the first pack day is that many days on.
    expect(text()).toContain(`Login streak day ${firstDailyPack}`);
    expect(text()).toContain(`In ${firstDailyPack - 1} days`);
    // Nothing affordable, so no purchase is offered.
    expect([...host.querySelectorAll('button')].some((b) => /^Buy a /.test(b.textContent))).toBe(false);
  });

  it('says a reached Battle Pass pack is waiting', () => {
    useGameStore.setState({ coins: 0, seasonXP: firstPassPack.xpRequired });
    render();
    expect(text()).toContain(`Battle Pass tier ${firstPassPack.tier}`);
    expect(text()).toContain('claim it in the Battle Pass');
  });

  // A returning player's save still holds the ended season's XP and claims.
  // Read straight, the panel said a tier-8 pack was "Reached — claim it",
  // and opening the pass to claim it rolled the season and wiped it.
  //
  // Changed when a season's end started delivering every reached, unclaimed
  // tier: an unclaimed pack tier now arrives as packs (the next test), so
  // this save has claimed its whole free track and the table stays empty.
  it("reads the Battle Pass of this season, not the save's ended one", () => {
    const last = BATTLE_PASS_REWARDS[BATTLE_PASS_REWARDS.length - 1];
    useGameStore.setState({
      coins: 0,
      seasonKey: `season-${getCurrentSeason().number - 1}`,
      seasonXP: last.xpRequired,
      claimedBattlePassRewards: { free: BATTLE_PASS_REWARDS.map((r) => r.tier), premium: [] },
    });
    render();
    expect(useGameStore.getState().seasonKey).toBe(getCurrentSeason().key);
    expect(text()).toContain(`Battle Pass tier ${firstPassPack.tier} · ${firstPassPack.free.amount} pack`);
    expect(text()).toContain(`${firstPassPack.xpRequired} XP to go`);
    expect(text()).not.toContain('claim it in the Battle Pass');
  });

  it('opens on the packs an ended season delivered, rather than calling the table empty', () => {
    useGameStore.setState({
      coins: 0,
      seasonKey: `season-${getCurrentSeason().number - 1}`,
      seasonXP: firstPassPack.xpRequired,
      claimedBattlePassRewards: { free: [], premium: [] },
    });
    render();
    expect(useGameStore.getState().cardPacks).toBe(firstPassPack.free.amount);
    expect(text()).not.toContain('No packs to open');
    expect(text()).toContain(`Open Pack (${firstPassPack.free.amount})`);
  });

  it('offers the pack when it is affordable, and buying it fills the table', () => {
    useGameStore.setState({ coins: cheapest.price });
    render();
    const buy = [...host.querySelectorAll('button')].find((b) => b.textContent === `Buy a ${cheapest.name}`);
    expect(buy).toBeTruthy();
    act(() => buy.click());
    expect(useGameStore.getState().cardPacks).toBe(cheapest.quantity);
    expect(useGameStore.getState().coins).toBe(0);
    expect(text()).not.toContain('No packs to open');
  });
});

// The table named where packs come from but could not take the player there.
// Each route is offered only where it leads to a pack.
describe("the empty table's routes", () => {
  const routes = () => ({ onGetGems: vi.fn(), onBattlePass: vi.fn(), onDailyRewards: vi.fn() });
  const cheapestGem = SHOP_ITEMS.filter((i) => ['pack', 'premium', 'legendary'].includes(i.type) && i.currency === 'gems')
    .reduce((a, b) => (a.price <= b.price ? a : b));

  it('sends a player short of gems to get them, and lets one with enough buy the gem pack', () => {
    const r = routes();
    useGameStore.setState({ coins: 0, gems: cheapestGem.price - 1 });
    render(r);
    expect(text()).toContain(`${cheapestGem.name} · ${cheapestGem.price} gems`);
    act(() => buttonNamed('Get gems').click());
    expect(r.onGetGems).toHaveBeenCalledTimes(1);
    act(() => root.unmount());

    useGameStore.setState({ gems: cheapestGem.price });
    render(r);
    expect(buttonNamed('Get gems')).toBeUndefined();
    act(() => buttonNamed(`Buy a ${cheapestGem.name}`).click());
    expect(useGameStore.getState().gems).toBe(0);
    expect(text()).not.toContain('No packs to open');
  });

  it('opens the Battle Pass only for a pack tier that is reached', () => {
    const r = routes();
    useGameStore.setState({ coins: 0, seasonXP: firstPassPack.xpRequired - 1 });
    render(r);
    expect(buttonNamed('Open the Battle Pass')).toBeUndefined();
    act(() => root.unmount());

    useGameStore.setState({ seasonXP: firstPassPack.xpRequired });
    render(r);
    act(() => buttonNamed('Open the Battle Pass').click());
    expect(r.onBattlePass).toHaveBeenCalledTimes(1);
  });

  it("opens Daily Rewards only when today's reward is unclaimed and pays packs", () => {
    const r = routes();
    render(r); // claimed today
    expect(buttonNamed('Open Daily Rewards')).toBeUndefined();
    act(() => root.unmount());

    // The streak continues from yesterday onto the first day that pays packs.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useGameStore.setState({ consecutiveLogins: firstDailyPack - 1, lastLoginDate: yesterday.toDateString() });
    render(r);
    expect(text()).toContain("Today's daily reward.");
    act(() => buttonNamed('Open Daily Rewards').click());
    expect(r.onDailyRewards).toHaveBeenCalledTimes(1);
  });
});
