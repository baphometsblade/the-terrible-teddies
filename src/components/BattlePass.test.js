import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { useGameStore, coinsForDuplicate, BATTLE_XP } from '@/stores/gameStore';
import { getDailyChallenges, getWeeklyChallenges } from '@/stores/challenges';
import { BATTLE_PASS_REWARDS, premiumTotals, countReadyRewards } from '@/lib/battlePass';
import { getCurrentSeason, formatSeasonEnd } from '@/utils/season';

// What the Battle Pass promises, against what the store and the tables do.
// Each expectation is derived from the live tables, not restated.

const toast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }), toast }));
const { default: BattlePass } = await import('./BattlePass');

const get = () => useGameStore.getState();
const firstCard = BATTLE_PASS_REWARDS.find((r) => r.premium?.type === 'card');

let host;
let root;
const render = (props = {}) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  MotionGlobalConfig.skipAnimations = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(BattlePass, { onClose() {}, ...props })));
  return host;
};
const text = () => host.textContent.replace(/\s+/g, ' ');
const button = (re) => [...host.querySelectorAll('button')].find((b) => re.test(b.getAttribute('aria-label') ?? b.textContent));
const click = (el) => act(() => { el.click(); });
const confirm = () => document.querySelector('[role="dialog"][aria-label="Unlock Premium Pass"]');

beforeEach(() => {
  localStorage.clear();
  get().resetProgress();
  toast.mockClear();
  useGameStore.setState({
    seasonKey: getCurrentSeason().key, seasonXP: 0, claimedBattlePassRewards: { free: [], premium: [] },
    hasBattlePassPremium: false, animationsEnabled: false, ownedCards: [1, 2, 3], unlockedCosmetics: [],
  });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  MotionGlobalConfig.skipAnimations = false;
  vi.useRealTimers();
});

describe('the reward tiles', () => {
  // They were platform emoji, and every card the same playing-card glyph.
  it('draw each card reward with its own art, and no emoji', () => {
    render();
    const cardIds = BATTLE_PASS_REWARDS.flatMap((r) => [r.free, r.premium]).filter((r) => r.type === 'card').map((r) => r.cardId);
    const art = [...host.querySelectorAll('[data-reward-art="card"] img')].map((img) => img.getAttribute('src'));
    expect(art).toEqual(cardIds.map((id) => `/cards/thumbs/${id}.webp`));
    expect(host.querySelectorAll('[data-reward-art="border"]').length).toBeGreaterThan(0);
    expect(text()).not.toMatch(/[🪙💎📦🃏✨🎭💠🎉👑]/u);
  });

  it('say a card already owned is owned, and what claiming it pays, before the claim', () => {
    useGameStore.setState({ hasBattlePassPremium: true, ownedCards: [1, firstCard.premium.cardId] });
    render();
    const claim = button(new RegExp(`^Claim tier ${firstCard.tier} premium reward`));
    const coins = coinsForDuplicate(firstCard.premium.cardId);
    expect(claim.getAttribute('aria-label')).toContain(`You already own it: claiming pays ${coins} coins instead`);
    expect(claim.querySelector('[data-owned]').textContent).toBe(`Owned·+${coins}`);
  });

  it('toast "Already owned" for a duplicate, with the coins it paid, not "Card Unlocked!"', () => {
    useGameStore.setState({ hasBattlePassPremium: true, ownedCards: [1, firstCard.premium.cardId], coins: 0 });
    render();
    click(button(new RegExp(`^Claim tier ${firstCard.tier} premium reward`)));
    const coins = coinsForDuplicate(firstCard.premium.cardId);
    expect(toast).toHaveBeenCalledWith({ title: 'Already owned', description: `${firstCard.premium.name} → +${coins} coins` });
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Card Unlocked!' }));
    expect(get().coins).toBe(coins);
  });

  it('toast "Card Unlocked!" for a card that is new', () => {
    useGameStore.setState({ hasBattlePassPremium: true });
    render();
    click(button(new RegExp(`^Claim tier ${firstCard.tier} premium reward`)));
    expect(toast).toHaveBeenCalledWith({ title: 'Card Unlocked!', description: `You got ${firstCard.premium.name}!` });
    expect(get().ownedCards).toContain(firstCard.premium.cardId);
  });

  it('badge the same "N ready" count the menu does', () => {
    useGameStore.setState({ seasonXP: 1000, hasBattlePassPremium: true, claimedBattlePassRewards: { free: [1], premium: [] } });
    render();
    const n = countReadyRewards({ seasonXP: 1000, claimed: { free: [1], premium: [] }, hasPremium: true });
    expect(text()).toContain(`${n} ready`);
    expect([...host.querySelectorAll('button')].filter((b) => /^Claim tier/.test(b.getAttribute('aria-label') ?? ''))).toHaveLength(n);
  });
});

describe('the footer', () => {
  // The boards rotate daily; pin a day with an XP challenge on them and one
  // without, found from the rotation itself.
  const xpOn = (date) => [...getDailyChallenges(date), ...getWeeklyChallenges(date)].filter((c) => c.reward.type === 'xp');
  const dayWhere = (pred) => {
    for (let i = 0; i < 120; i++) {
      const d = new Date(2026, 10, 2 + i, 12);
      if (pred(xpOn(d))) return d;
    }
    throw new Error('no such day in the rotation');
  };
  const on = (date) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(date);
    useGameStore.setState({ seasonKey: getCurrentSeason().key });
  };

  // It said "Win battles and complete daily challenges to earn XP!", and on
  // most days none of the challenges on the board paid XP.
  it('names a challenge only on a day one pays XP, with what it pays', () => {
    const day = dayWhere((xp) => xp.length > 0);
    on(day);
    render();
    const footer = host.querySelector('[data-xp-sources]').textContent;
    expect(footer).toContain(`+${BATTLE_XP.win} for a win, +${BATTLE_XP.loss} for a loss`);
    for (const c of xpOn(day)) expect(footer).toContain(`“${c.name}” pays +${c.reward.amount} XP`);
  });

  it('names battles alone on a day no challenge pays XP', () => {
    on(dayWhere((xp) => xp.length === 0));
    render();
    const footer = host.querySelector('[data-xp-sources]').textContent;
    expect(footer).toContain(`+${BATTLE_XP.win} for a win`);
    expect(footer).not.toMatch(/challenge/i);
  });

  it('drops a challenge already claimed', () => {
    const day = dayWhere((xp) => xp.length > 0);
    on(day);
    const [xpChallenge] = xpOn(day);
    useGameStore.setState({ claimedChallenges: [xpChallenge.id] });
    render();
    expect(host.querySelector('[data-xp-sources]').textContent).not.toContain(xpChallenge.name);
  });
});

describe('the Premium confirmation', () => {
  const open = (props) => {
    render(props);
    click(button(/^Unlock Premium/));
    return confirm();
  };

  it('states the term: the season, when it ends, and what resets', () => {
    const season = getCurrentSeason();
    const term = open().querySelector('[data-pass-term]').textContent.replace(/\s+/g, ' ');
    expect(term).toContain(season.name);
    expect(term).toContain(formatSeasonEnd(season.endDate));
    expect(term).toContain(`${season.daysLeft} day`);
    expect(term).toMatch(/XP, tiers and Premium reset/);
    expect(term).toMatch(/delivered to you/);
  });

  // It promised "3 guaranteed legendary cards" as if new; a legendary the
  // player already owns pays coins.
  it("adds up what the premium track pays from the table, and says which cards you own", () => {
    const totals = premiumTotals();
    const owned = totals.cards[0];
    useGameStore.setState({ ownedCards: [1, owned.cardId] });
    const dialog = open();
    const t = dialog.textContent.replace(/\s+/g, ' ');
    expect(t).toContain(`${totals.cards.length} cards, ${totals.cards.filter((c) => c.rarity === 'legendary').length} of them legendary`);
    expect(t).toContain(`You own ${owned.name} already: it pays ${coinsForDuplicate(owned.cardId)} coins instead.`);
    expect(t).toContain(`+${totals.gems} gems, +${totals.coins.toLocaleString()} coins and ${totals.packs} card packs`);
    expect(t).not.toMatch(/guaranteed legendary/i);
  });

  it('turns a short balance into a route to gems, keeping Cancel first in focus', () => {
    useGameStore.setState({ gems: 10 });
    const onGetGems = vi.fn();
    const dialog = open({ onGetGems });
    expect(document.activeElement.textContent).toBe('Cancel');
    expect([...dialog.querySelectorAll('button')].some((b) => b.textContent === 'Purchase')).toBe(false);
    const getGems = [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Get gems');
    expect(getGems.className).toContain('btn-brass');
    click(getGems);
    expect(onGetGems).toHaveBeenCalledTimes(1);
    expect(get().gems).toBe(10);
  });

  it('offers Purchase when the balance covers it', () => {
    useGameStore.setState({ gems: 600 });
    const dialog = open({ onGetGems() {} });
    const purchase = [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Purchase');
    expect(purchase.disabled).toBe(false);
    click(purchase);
    expect(get()).toMatchObject({ hasBattlePassPremium: true, gems: 100 });
  });
});

describe('the season’s last days', () => {
  it('say how many rewards are unclaimed and when the season stops', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const season = getCurrentSeason();
    vi.setSystemTime(new Date(season.endDate.getTime() - 3 * 86_400_000));
    useGameStore.setState({ seasonXP: 300 });
    render();
    const n = countReadyRewards({ seasonXP: 300, claimed: { free: [], premium: [] }, hasPremium: false });
    const line = host.querySelector('[data-season-ending]').textContent;
    expect(line).toContain(`${n} unclaimed — claim before ${formatSeasonEnd(season.endDate)}.`);
    expect(line).toContain('delivered to you');
  });

  it('say nothing earlier in the season, or with nothing to claim', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const season = getCurrentSeason();
    vi.setSystemTime(new Date(season.endDate.getTime() - 30 * 86_400_000));
    render();
    expect(host.querySelector('[data-season-ending]')).toBeNull();
    act(() => root.unmount());
    vi.setSystemTime(new Date(season.endDate.getTime() - 86_400_000));
    useGameStore.setState({ claimedBattlePassRewards: { free: [1], premium: [] } });
    render();
    expect(host.querySelector('[data-season-ending]')).toBeNull();
  });
});
