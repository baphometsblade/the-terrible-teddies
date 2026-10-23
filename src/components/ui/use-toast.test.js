import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useToast, toast, resetToasts, readingTime } from './use-toast';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Effects list `dismiss` (and `toast`) as dependencies — the battle board's
// turn-banner and game-over effects do. If either changed identity on each
// render, those effects would re-run on every render of their component, and
// the board's would dismiss each toast the moment it appeared.
describe('useToast', () => {
  it('returns the same toast and dismiss functions on every render', () => {
    const seen = [];
    let bump;
    const Probe = () => {
      const [, setN] = useState(0);
      bump = () => setN((n) => n + 1);
      const { toast: t, dismiss } = useToast();
      useEffect(() => { seen.push({ toast: t, dismiss }); });
      return null;
    };
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => root.render(createElement(Probe)));
    act(() => bump());
    act(() => bump());
    act(() => root.unmount());
    expect(seen.length).toBe(3);
    expect(new Set(seen.map((s) => s.dismiss)).size).toBe(1);
    expect(new Set(seen.map((s) => s.toast)).size).toBe(1);
  });
});

// One toast is on screen at a time. App's achievement, level-up and season
// drains used to replace each other (and anything else raised at the same
// moment), so all but the last were cut short or never seen.
describe('the toast line', () => {
  let root;
  let latest;
  let api;
  // Every title that has been on screen, in order, once each time it came on.
  let seen;
  const Probe = () => {
    api = useToast();
    latest = api.toasts;
    const open = latest.find((t) => t.open);
    useEffect(() => {
      if (open) seen.push(open.title);
    }, [open]);
    return null;
  };
  // What is on screen: the open toast's title, or null.
  const onScreen = () => latest.find((t) => t.open)?.title ?? null;
  // Radix closing a toast when its time is up, or the player swiping it.
  const timeUp = () => act(() => latest.find((t) => t.open).onOpenChange(false));
  const wait = (ms) => act(() => { vi.advanceTimersByTime(ms); });

  beforeEach(() => {
    vi.useFakeTimers();
    resetToasts();
    seen = [];
    root = createRoot(document.createElement('div'));
    act(() => root.render(createElement(Probe)));
  });
  afterEach(() => {
    act(() => root.unmount());
    resetToasts();
    vi.useRealTimers();
  });

  it('shows announcements in turn, each after the last has gone', () => {
    act(() => {
      toast({ queue: true, title: 'Achievement' });
      toast({ queue: true, title: 'Level 2!' });
      toast({ queue: true, title: 'Season rewards delivered' });
    });
    // A beat after it is raised, so whatever raised it lands first.
    expect(onScreen()).toBe(null);
    wait(400);
    expect(onScreen()).toBe('Achievement');
    timeUp();
    expect(onScreen()).toBe(null); // the pause, while it leaves
    wait(400);
    expect(onScreen()).toBe('Level 2!');
    timeUp();
    wait(400);
    expect(onScreen()).toBe('Season rewards delivered');
    timeUp();
    wait(400);
    expect(onScreen()).toBe(null);
  });

  it('gives an announcement its reading time, unless it names its own', () => {
    act(() => {
      toast({ queue: true, title: 'Level 2!', description: 'Level-up bonus: +200 coins' });
    });
    wait(400);
    const shown = latest.find((t) => t.open);
    expect(shown.duration).toBe(readingTime('Level 2!', 'Level-up bonus: +200 coins'));
    expect(shown.duration).toBeGreaterThanOrEqual(4000);
    timeUp();
    wait(400);
    act(() => { toast({ queue: true, title: 'Long', duration: 9000 }); });
    wait(400);
    expect(latest.find((t) => t.open).duration).toBe(9000);
  });

  it('lets feedback replace feedback at once: it answers the last tap', () => {
    act(() => {
      toast({ title: 'Not enough energy!' });
      toast({ title: 'Field is full!' });
    });
    expect(onScreen()).toBe('Field is full!');
  });

  it('brings an announcement that feedback interrupted back, whole, afterwards', () => {
    act(() => { toast({ queue: true, title: 'Achievement' }); });
    wait(400);
    expect(onScreen()).toBe('Achievement');
    act(() => { toast({ title: 'Purchase Successful!' }); });
    expect(onScreen()).toBe('Purchase Successful!');
    timeUp();
    wait(400);
    expect(onScreen()).toBe('Achievement');
  });

  it('waits an announcement behind feedback that is showing', () => {
    act(() => {
      toast({ title: 'Coins Claimed!' });
      toast({ queue: true, title: 'Level 2!' });
    });
    expect(onScreen()).toBe('Coins Claimed!');
    timeUp();
    wait(400);
    expect(onScreen()).toBe('Level 2!');
  });

  // The battle board clears the spot at every turn boundary, as it asks
  // whether to leave and at game over. That used to empty the line as well,
  // and a battle's achievements, raised in the same moment as the game-over
  // clear, were never seen. Now the clear holds the line long enough for the
  // turn banner or the result dialog to land, and then it picks up.
  it('holds the line when the spot is cleared, then shows what was waiting', () => {
    act(() => {
      toast({ title: 'Still finding the floor' });
      toast({ queue: true, title: 'Achievement' });
    });
    act(() => api.dismiss());
    expect(onScreen()).toBe(null);
    wait(1499);
    expect(onScreen()).toBe(null);
    wait(1);
    expect(onScreen()).toBe('Achievement');
  });

  // The order the game-over clear and the achievements arrive in varies: an
  // announcement raised just before the clear never flashes up under it.
  it('shows nothing of an announcement raised just before a clear until the hold is over', () => {
    act(() => {
      toast({ queue: true, title: 'Damage Dealer' });
      toast({ queue: true, title: 'Medic Bear' });
    });
    act(() => api.dismiss());
    wait(1499);
    expect(seen).toEqual([]);
    wait(1);
    expect(onScreen()).toBe('Damage Dealer');
    timeUp();
    wait(400);
    expect(seen).toEqual(['Damage Dealer', 'Medic Bear']);
  });

  // Play Again during the first achievement: the new game's turn banner
  // clears the spot. The one it cut short comes back whole, then the rest.
  it('brings back an announcement a clear cut short, then the rest in turn', () => {
    act(() => {
      toast({ queue: true, title: 'Veteran' });
      toast({ queue: true, title: 'Damage Dealer' });
    });
    wait(400);
    expect(onScreen()).toBe('Veteran');
    act(() => api.dismiss());
    expect(onScreen()).toBe(null);
    wait(1500);
    expect(onScreen()).toBe('Veteran');
    timeUp();
    wait(400);
    expect(onScreen()).toBe('Damage Dealer');
  });

  it('starts the hold again if the spot is cleared again', () => {
    act(() => { toast({ queue: true, title: 'Achievement' }); });
    act(() => api.dismiss());
    wait(1000);
    act(() => api.dismiss());
    wait(1000);
    expect(onScreen()).toBe(null);
    wait(500);
    expect(onScreen()).toBe('Achievement');
  });

  it('lets feedback through during a hold', () => {
    act(() => { toast({ queue: true, title: 'Achievement' }); });
    act(() => api.dismiss());
    act(() => { toast({ title: 'Not enough energy!' }); });
    expect(onScreen()).toBe('Not enough energy!');
    wait(1500);
    expect(onScreen()).toBe('Not enough energy!');
    timeUp();
    wait(400);
    expect(onScreen()).toBe('Achievement');
  });

  it('takes a waiting announcement out of the line when it is dismissed by id', () => {
    let second;
    act(() => {
      toast({ queue: true, title: 'First' });
      second = toast({ queue: true, title: 'Second' });
      toast({ queue: true, title: 'Third' });
    });
    wait(400);
    act(() => second.dismiss());
    timeUp();
    wait(400);
    expect(onScreen()).toBe('Third');
  });
});
