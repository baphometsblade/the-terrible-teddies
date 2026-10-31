import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import DeckBuilder from './DeckBuilder';
import { useGameStore, ALL_CARDS } from '@/stores/gameStore';

// The Deck Builder has no card page, so a card in the deck opens its flavor
// line under its row: the card's joke, drawn as the Collection and the pack
// reveal draw it (FlavorLine). Expectations are read from ALL_CARDS by id.
const card = (id) => ALL_CARDS.find((c) => c.id === id);
const DECK = [1, 2, 6, 30, 40];

let host;
let root;
const render = () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(DeckBuilder, { onBackToMenu() {} })));
};
const panel = () => host.querySelector('[data-deck-panel]');
const toggles = () => [...panel().querySelectorAll('[data-flavor-toggle]')];
const toggleFor = (id) => panel().querySelector(`[data-flavor-toggle][aria-label="Flavor line for ${card(id).name}"]`);
const panels = () => [...panel().querySelectorAll('[data-flavor-panel]')];

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.setState({ ownedCards: ALL_CARDS.map((c) => c.id), currentDeck: DECK, animationsEnabled: false });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe("a deck card's flavor line", () => {
  it('is closed, behind its name, until it is asked for', () => {
    render();
    expect(toggles()).toHaveLength(DECK.length);
    for (const toggle of toggles()) expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panels()).toHaveLength(0);
    for (const id of DECK) expect(panel().textContent).not.toContain(card(id).description);
  });

  it('opens under its row as the data has it, and closes again', () => {
    render();
    act(() => toggleFor(2).click());
    expect(toggleFor(2).getAttribute('aria-expanded')).toBe('true');
    expect(panels()).toHaveLength(1);
    const line = panels()[0].querySelector('p');
    expect(line.textContent).toBe(card(2).description);
    // The toggle says what it controls.
    expect(toggleFor(2).getAttribute('aria-controls')).toBe(panels()[0].id);
    // The row it opened under is card 2's: its name is in that row.
    expect(panels()[0].parentElement.textContent).toContain(card(2).name);

    act(() => toggleFor(2).click());
    expect(toggleFor(2).getAttribute('aria-expanded')).toBe('false');
    expect(toggleFor(2).hasAttribute('aria-controls')).toBe(false);
    expect(panels()).toHaveLength(0);
  });

  it('opens each row on its own', () => {
    render();
    act(() => toggleFor(1).click());
    act(() => toggleFor(30).click());
    expect(panels().map((p) => p.querySelector('p').textContent)).toEqual([card(1).description, card(30).description]);
    act(() => toggleFor(1).click());
    expect(panels().map((p) => p.querySelector('p').textContent)).toEqual([card(30).description]);
  });

  it('goes with its card: a removed card takes its open line with it', async () => {
    render();
    act(() => toggleFor(6).click());
    expect(panels()).toHaveLength(1);
    const remove = panel().querySelector(`button[aria-label="Remove ${card(6).name} from deck"]`);
    act(() => remove.click());
    // The row slides out first (AnimatePresence), then it is gone.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 700)); });
    expect(toggleFor(6)).toBeNull();
    expect(panels()).toHaveLength(0);
    expect(panel().textContent).not.toContain(card(6).description);
  });

  it('is named for the card, and the name the screen shows is in it', () => {
    render();
    for (const id of DECK) {
      const toggle = toggleFor(id);
      expect(toggle.getAttribute('aria-label')).toBe(`Flavor line for ${card(id).name}`);
      // The visible text is the card's name (label in name).
      expect(toggle.textContent).toBe(card(id).name);
    }
  });

  it('adds one tab stop a row, a button, and no other control', () => {
    render();
    const list = panel().querySelector('[data-deck-list]');
    const stops = list.querySelectorAll('button, a, [tabindex]');
    // The flavor toggle and Remove, for each of the five cards.
    expect(stops).toHaveLength(DECK.length * 2);
    act(() => toggleFor(1).click());
    // An open line is print.
    expect(list.querySelectorAll('button, a, [tabindex]')).toHaveLength(DECK.length * 2);
    expect(panels()[0].querySelector('button, a, [tabindex]')).toBeNull();
  });

  it('does not touch the deck: opening a line changes nothing that is saved or unsaved', () => {
    render();
    act(() => toggleFor(1).click());
    expect(panel().querySelector('[data-unsaved], [data-unset]')).toBeNull();
    expect(useGameStore.getState().currentDeck).toEqual(DECK);
  });
});
