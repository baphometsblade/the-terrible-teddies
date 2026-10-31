import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALL_CARDS } from '@/stores/gameStore';
import FlavorLine, { FLAVOR_LINE, FLAVOR_MAX } from './FlavorLine';

// The best jokes in the game are the cards' flavor lines, and one component
// draws them everywhere a card is met: the Collection's detail (where they
// began), the pack reveal and the Deck Builder.
const dom = (node) => {
  const el = document.createElement('div');
  el.innerHTML = renderToStaticMarkup(node);
  return el;
};

describe('FlavorLine', () => {
  it('draws every card\'s line exactly as the data has it, wrapped in nothing', () => {
    for (const card of ALL_CARDS) {
      const p = dom(<FlavorLine card={card} />).querySelector('p');
      expect(p.textContent, card.name).toBe(card.description);
      expect(p.children, `${card.name} has markup inside its line`).toHaveLength(0);
    }
  });

  it('draws nothing for a card with no line', () => {
    expect(dom(<FlavorLine card={{ id: 1, name: 'X' }} />).children).toHaveLength(0);
    expect(dom(<FlavorLine card={{ id: 1, name: 'X', description: '' }} />).children).toHaveLength(0);
    expect(dom(<FlavorLine card={null} />).children).toHaveLength(0);
  });

  // The Collection's detail set the look; the other screens take it from here.
  // Restyling the line is a decision for every screen at once, so it is made
  // here and in this test.
  it('is the Collection\'s style: 14px, relaxed, plush-200', () => {
    expect(FLAVOR_LINE).toBe('text-sm leading-relaxed text-plush-200');
    expect(dom(<FlavorLine card={ALL_CARDS[0]} />).querySelector('p').className).toBe(FLAVOR_LINE);
  });

  it('takes a layout class after the style, and passes other attributes on', () => {
    const p = dom(<FlavorLine card={ALL_CARDS[0]} className="text-center" data-flavor-of="1" />).querySelector('p');
    expect(p.className).toBe(`${FLAVOR_LINE} text-center`);
    expect(p.getAttribute('data-flavor-of')).toBe('1');
  });

  it('is plain content: a paragraph, not hidden, not a tab stop', () => {
    const p = dom(<FlavorLine card={ALL_CARDS[0]} />).querySelector('p');
    expect(p.getAttribute('aria-hidden')).toBeNull();
    expect(p.hasAttribute('tabindex')).toBe(false);
  });
});

// The slot every line has to fit, so the copy deck's rewrites drop in without
// touching a layout. Read from the live table, not restated.
describe("every card's line", () => {
  it('is there, and fits the slot', () => {
    for (const card of ALL_CARDS) {
      expect(card.description?.trim(), `${card.name} has no flavor line`).toBeTruthy();
      expect(card.description.length, `${card.name}'s line is over the slot`).toBeLessThanOrEqual(FLAVOR_MAX);
    }
  });
});

// One visual reference: the screens that show a line draw it through
// FlavorLine and never restate its classes or reach for card.description
// themselves, which is how the three would drift apart.
describe('the screens that show a flavor line', () => {
  const SCREENS = ['TeddyCollection.jsx', 'CardPackOpening.jsx'];
  const source = (file) => readFileSync(join(process.cwd(), 'src/components', file), 'utf8');

  it.each(SCREENS)('%s draws it through FlavorLine', (file) => {
    const text = source(file);
    expect(text).toMatch(/import FlavorLine from '\.\/FlavorLine'/);
    expect(text).toMatch(/<FlavorLine\b/);
  });

  it.each(SCREENS)('%s restates neither its classes nor the card\'s description', (file) => {
    const text = source(file);
    expect(text).not.toContain('text-sm leading-relaxed text-plush-200');
    expect(text).not.toMatch(/\b(card|teddy|shownCard)\.description\b/);
  });
});
