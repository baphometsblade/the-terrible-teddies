import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import PlayerStats from './PlayerStats';
import { useGameStore } from '@/stores/gameStore';
import { HOUSE_RANKS, houseRank, rankLevels } from '@/lib/houseRank';

// The header's house rank: derived from the level, drawn under the name.
let host;
let root;
const render = () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(PlayerStats, { onClose() {} })));
};
const label = () => host.querySelector('[data-house-rank]');

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({ animationsEnabled: false });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe("Player Stats' house rank", () => {
  it.each(HOUSE_RANKS.map((row) => [row.name, row]))('names %s, and the levels it covers, from the first level it holds', (_name, row) => {
    useGameStore.setState({ level: row.min });
    render();
    const line = label();
    expect(line, 'no rank under the name').not.toBeNull();
    // The rank and its levels as the table words them, each on its own span.
    const seen = [...line.children].filter((c) => !c.classList.contains('sr-only')).map((c) => c.textContent);
    expect(seen).toEqual([row.name, rankLevels(row.min).label]);
    // A screen reader gets the rank, then the levels in words.
    expect(line.querySelector('.sr-only').textContent).toBe(`, ${rankLevels(row.min).spoken}`);
    expect(line.querySelector('[aria-hidden="true"]').textContent).toBe(rankLevels(row.min).label);
  });

  it('holds the rank of a level inside a rung, not only its first', () => {
    const [, second] = HOUSE_RANKS;
    useGameStore.setState({ level: second.min + 1 });
    render();
    expect(label().firstElementChild.textContent).toBe(second.name);
  });

  it('sits under the name and above the level and its XP', () => {
    useGameStore.setState({ level: HOUSE_RANKS[1].min });
    render();
    const name = host.querySelector('h2');
    const chip = [...host.querySelectorAll('span')].find((s) => /^Lv\. \d+$/.test(s.textContent));
    expect(chip, 'the level chip').toBeTruthy();
    expect(name.compareDocumentPosition(label()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label().compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('follows the level up the ladder, and writes nothing down', () => {
    const [first, second] = HOUSE_RANKS;
    useGameStore.setState({ level: second.min - 1 });
    render();
    expect(label().firstElementChild.textContent).toBe(first.name);
    act(() => useGameStore.setState({ level: second.min }));
    expect(label().firstElementChild.textContent).toBe(second.name);
    // Derived from the level: not a thing the save holds.
    const saved = localStorage.getItem('terrible-teddies-storage') ?? '';
    for (const row of HOUSE_RANKS) expect(saved).not.toContain(row.name);
    expect(houseRank(useGameStore.getState().level)).toBe(second);
  });

  it('is print, not a control: no tab stop, nothing to press', () => {
    useGameStore.setState({ level: HOUSE_RANKS[2].min });
    render();
    const line = label();
    expect(line.tagName).toBe('P');
    expect(line.closest('button, a')).toBeNull();
    expect(line.hasAttribute('tabindex')).toBe(false);
    expect(line.querySelector('button, a, [tabindex]')).toBeNull();
  });

  // An 11px label: the smallest print the screens set, and the smallest a
  // rank may be drawn (the brief's floor is 8px on screen).
  it('is drawn in the small-caps label style', () => {
    useGameStore.setState({ level: HOUSE_RANKS[1].min });
    render();
    expect(label().classList.contains('label-caps')).toBe(true);
  });
});
