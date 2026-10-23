import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// jsdom has no canvas to throw confetti on.
vi.mock('@/lib/celebrate', () => ({ celebrate: vi.fn() }));

import Challenges, { REWARD_LOOK, rewardLabel } from './Challenges';
import { useGameStore } from '@/stores/gameStore';
import { DAILY_POOL, WEEKLY_POOL, getDailyChallenges } from '@/stores/challenges';
import { useToast } from '@/components/ui/use-toast';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('reward labels', () => {
  // Every reward a challenge can pay has a name in words. The claim toast
  // printed the type key ("Claimed: 1 legendaryPack", "2 pack", "100 xp"),
  // so a reward type added to the pools without a label fails here.
  it('names every reward type the challenge pools pay', () => {
    const types = [...new Set([...DAILY_POOL, ...WEEKLY_POOL].map((c) => c.reward.type))];
    expect(types.filter((t) => !REWARD_LOOK[t])).toEqual([]);
  });

  it('says the reward the way a player would', () => {
    expect(rewardLabel('legendaryPack', 1)).toBe('1 Legendary Pack');
    expect(rewardLabel('pack', 2)).toBe('2 Card Packs');
    expect(rewardLabel('xp', 100)).toBe('100 XP');
    expect(rewardLabel('coins', 1000)).toBe('1,000 coins');
    expect(rewardLabel('gems', 1)).toBe('1 gem');
  });
});

describe('claiming a challenge', () => {
  let host;
  let root;
  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetProgress();
    useGameStore.setState({
      todayWins: 10, todayBattles: 10, todayDamageDealt: 500, todayCardsPlayed: 50,
      dailyStatsDate: new Date().toDateString(), claimedChallenges: [],
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('pays out in place and in words, not in a toast over the dialog', () => {
    vi.useFakeTimers();
    act(() => root.render(<Challenges onClose={() => {}} />));
    const [first] = getDailyChallenges();
    const toasts = [];
    // Anything that still raised a toast would land in the shared toast state.
    const Probe = () => { toasts.push(useToast().toasts.length); return null; };
    const probeHost = document.createElement('div');
    const probeRoot = createRoot(probeHost);
    act(() => probeRoot.render(<Probe />));

    const claim = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Claim');
    act(() => claim.click());

    const status = host.querySelector('[role="status"]');
    expect(status.textContent).toBe(`${first.name} claimed: ${rewardLabel(first.reward.type, first.reward.amount)}.`);
    const float = host.querySelector('[data-claim-float]');
    expect(float?.textContent).toBe(`+${first.reward.amount.toLocaleString()}`);
    expect(float.closest('[aria-hidden="true"]')).toBeTruthy();
    expect(toasts.at(-1)).toBe(0);

    // The float is an event, not a fixture: it goes once it has risen.
    act(() => { vi.advanceTimersByTime(1300); });
    expect(host.querySelector('[data-claim-float]')).toBeNull();
    // The words stay for anyone who reads the region again.
    expect(status.textContent).toContain(first.name);
    act(() => probeRoot.unmount());
  });
});
