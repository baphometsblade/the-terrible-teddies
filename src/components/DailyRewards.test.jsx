import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';

// jsdom has no canvas to throw confetti on; the test only needs to know it
// was asked for.
vi.mock('@/lib/celebrate', () => ({ celebrate: vi.fn() }));

import DailyRewards from './DailyRewards';
import { useGameStore, ALL_CARDS } from '@/stores/gameStore';
import { celebrate } from '@/lib/celebrate';
import { getTimeUntilReset } from '@/lib/resetTimer';
import { readFileSync } from 'fs';
import { resolve } from 'path';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const get = () => useGameStore.getState();
let host;
let root;
const render = (onClose = () => {}) => act(() => {
  root.render(<StrictMode><DailyRewards onClose={onClose} /></StrictMode>);
});
const button = (name) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
const look = (day) => host.querySelector(`[data-day="${day}"]`)?.getAttribute('data-look');

// 10:00 local on a mid-June day, with yesterday's claim on record: today is
// day 2 of the streak, which grants 75 coins and a card.
const NOW = new Date(2026, 5, 17, 10, 0, 0);
const yesterday = () => { const d = new Date(NOW); d.setDate(d.getDate() - 1); return d.toDateString(); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  // A clean store, not resetProgress: a reset keeps gems, packs, the pass and
  // the claim ledgers, which would leak from one test into the next.
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({
    coins: 0, lastLoginDate: yesterday(), consecutiveLogins: 1,
    ownedCards: ALL_CARDS.slice(0, 10).map((c) => c.id),
    // The card reveal skips its deal with Animations off; jsdom has no layout.
    animationsEnabled: false,
  });
  celebrate.mockClear();
  // jsdom lays nothing out, so it has no scrollIntoView; the panel calls it
  // to keep the button in view as the claim grows the panel.
  Element.prototype.scrollIntoView = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('Daily Rewards', () => {
  it('waits for the tap: opening the panel grants nothing', () => {
    // It used to claim on mount, so the panel opened on "Claimed!" and the
    // player never pressed anything to collect.
    render();
    expect(get().coins).toBe(0);
    expect(get().lastLoginDate).toBe(yesterday());
    expect(button('Claim')).toBeTruthy();
    expect(look(2)).toBe('today');
    expect(look(1)).toBe('past');
    expect(host.textContent).toContain('Day 2 is ready');
  });

  it('collects on Claim: stamps today, names the card, and turns the button into Continue', async () => {
    render();
    const claim = button('Claim');
    claim.focus();
    act(() => claim.click());
    expect(get().coins).toBeGreaterThanOrEqual(75);
    expect(get().lastLoginDate).toBe(NOW.toDateString());
    // Under StrictMode, still one grant.
    expect(get().consecutiveLogins).toBe(2);
    expect(look(2)).toBe('stamped');
    expect(look(3)).toBe('tomorrow');
    // The same element, so the focus the tap gave it stays.
    expect(button('Continue')).toBe(claim);
    expect(document.activeElement).toBe(claim);

    const granted = get().ownedCards.filter((id) => !ALL_CARDS.slice(0, 10).some((c) => c.id === id));
    expect(granted).toHaveLength(1);
    const card = ALL_CARDS.find((c) => c.id === granted[0]);
    const status = host.querySelector('[role="status"]').textContent;
    expect(status).toContain('Day 2 claimed: 75 coins and 1 card.');
    expect(status).toContain(`New card: ${card.name}`);
    // And the card itself is on the table, face up with Animations off, once
    // the reveal's module (loaded only on a card day) has arrived.
    await act(async () => { await import('./CardPackOpening'); });
    await act(async () => {});
    expect(host.querySelector(`[data-granted-card="${card.id}"] [data-reveal-card="up"]`)).toBeTruthy();

    act(() => { vi.advanceTimersByTime(300); });
    expect(celebrate).toHaveBeenCalledTimes(1);
    // The claim grew the panel; the button it turned into is brought back
    // into view.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(claim);
  });

  // Claim turns into Continue on the same element, so a quick double tap's
  // second half landed on Continue and closed the panel before the payout
  // and the card were seen.
  it('holds Continue for a beat after the claim, so a double tap does not close it', () => {
    const onClose = vi.fn();
    render(onClose);
    const claim = button('Claim');
    act(() => claim.click());
    act(() => claim.click());
    expect(onClose).not.toHaveBeenCalled();
    expect(claim.getAttribute('aria-disabled')).toBe('true');
    act(() => { vi.advanceTimersByTime(400); });
    expect(claim.hasAttribute('aria-disabled')).toBe(false);
    act(() => claim.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('with motion on, holds until the card has turned, and a tap in the beat turns it at once', async () => {
    useGameStore.setState({ animationsEnabled: true });
    const onClose = vi.fn();
    render(onClose);
    await act(async () => { await import('./CardPackOpening'); });
    const claim = button('Claim');
    act(() => claim.click());
    act(() => { vi.advanceTimersByTime(250); });
    // The second tap: nothing closes, and the card, not yet even dealt, is
    // put on the table face up.
    act(() => claim.click());
    await act(async () => {});
    expect(onClose).not.toHaveBeenCalled();
    expect(host.querySelector('[data-granted-card] [data-reveal-card="up"]')).toBeTruthy();
    // Still held until the turn the timeline planned (1.1s, plus a beat).
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => claim.click());
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    act(() => claim.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reopens on today stamped and the time to the next reward', () => {
    useGameStore.setState({ lastLoginDate: NOW.toDateString(), consecutiveLogins: 2 });
    render();
    expect(look(2)).toBe('stamped');
    expect(look(3)).toBe('tomorrow');
    expect(button('Continue')).toBeTruthy();
    expect(button('Claim')).toBeUndefined();
    expect(host.textContent).toContain(`Next reward in ${getTimeUntilReset(false, NOW)}`);
    expect(get().coins).toBe(0);
  });

  it('turns back into a claim when the panel is left open past midnight', () => {
    vi.setSystemTime(new Date(2026, 5, 17, 23, 59, 50));
    useGameStore.setState({ lastLoginDate: NOW.toDateString(), consecutiveLogins: 2 });
    render();
    expect(button('Continue')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(30000); });
    expect(button('Claim')).toBeTruthy();
    expect(look(3)).toBe('today');
  });

  it('loads the pack opening only for the cards, never with the panel', () => {
    // A static import of CardPackOpening (for RevealCard) put the whole Card
    // Packs dialog, its shop and the Battle Pass table into every opening of
    // this panel, which auto-opens on the day's first launch.
    const src = readFileSync(resolve(process.cwd(), 'src/components/DailyRewards.jsx'), 'utf8');
    expect(src).not.toMatch(/^import[^;]*from '\.\/CardPackOpening'/m);
    expect(src).toMatch(/import\('\.\/CardPackOpening'\)/);
  });
});
