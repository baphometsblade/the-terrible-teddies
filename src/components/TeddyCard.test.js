import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TeddyCard from './TeddyCard';
import { ALL_CARDS } from '@/stores/gameStore';

const render = (props) => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(TeddyCard, props));
  return host;
};
const byName = (name) => ALL_CARDS.find((c) => c.name === name);
const creatures = ALL_CARDS.filter((c) => c.type === 'action');

// Every element that sets a font size in px, with that size.
const sized = (host) => [...host.querySelectorAll('[class]')]
  .map((el) => ({ el, px: Number(/(?:^|\s)text-\[(\d+(?:\.\d+)?)px\]/.exec(el.getAttribute('class'))?.[1]) }))
  .filter(({ px }) => px);

describe('TeddyCard on the battle table (variant="board")', () => {
  it('drops the cost coin and the rarity; the hand card keeps both', () => {
    for (const card of creatures) {
      const hand = render({ teddy: card });
      const board = render({ teddy: card, variant: 'board' });
      expect(hand.querySelector('[data-cost]')?.textContent, card.name).toBe(String(card.cost));
      expect(board.querySelector('[data-cost]'), card.name).toBeNull();
      // At hand size the rarity is a gem in the tier's metal, named to a
      // screen reader; on the table the frame's metal is all of it.
      expect(hand.querySelector('[data-rarity-gem]')?.dataset.rarityGem, card.name).toBe(card.rarity);
      expect(hand.textContent, card.name).toContain(card.rarity);
      expect(board.querySelector('[data-rarity-gem]'), card.name).toBeNull();
      expect(board.textContent, card.name).not.toContain(card.rarity);
    }
  });

  it('draws the stats as 28px badges with 14px numerals', () => {
    const board = render({ teddy: byName('Feral Tim'), variant: 'board' });
    const badges = [...board.querySelectorAll('[title="Attack"], [title="HP"]')];
    expect(badges).toHaveLength(2);
    for (const b of badges) expect(b.getAttribute('class')).toMatch(/w-\[28px\][\s\S]*h-\[28px\][\s\S]*text-\[14px\]/);
  });

  it('shows the ability as an icon chip that still names it to a screen reader', () => {
    const board = render({ teddy: byName('Feral Tim'), variant: 'board' });
    expect(board.querySelector('.sr-only')?.textContent).toBe('Swarm');
    // The hand card's printed rules line is not drawn as well.
    expect(board.querySelectorAll('.truncate')).toHaveLength(0);
  });

  it('draws Taunt as its side\'s frame, and only while it is in force', () => {
    const sally = byName('Shit-Talk Sally');
    expect(sally.ability).toBe('taunt');
    expect(render({ teddy: sally, variant: 'board' }).querySelector('[data-taunt]')?.dataset.taunt).toBe('player');
    expect(render({ teddy: sally, variant: 'board', side: 'opponent' }).querySelector('[data-taunt]')?.dataset.taunt).toBe('opponent');
    expect(render({ teddy: sally, variant: 'board', tauntActive: false }).querySelector('[data-taunt]')).toBeNull();
    // Off the table there is no frame: the hand card prints the keyword.
    expect(render({ teddy: sally }).querySelector('[data-taunt]')).toBeNull();
  });

  it('keeps a trap\'s rules and type on the table, since that is the whole card', () => {
    const trap = byName('Honey Trap');
    const board = render({ teddy: trap, variant: 'board' });
    expect(board.textContent).toContain(`${trap.amount} DMG`);
    expect(board.textContent).toContain('Trap');
    expect(board.textContent).not.toContain(trap.rarity);
  });
});

describe('TeddyCard cost coin', () => {
  it('shows the cost an effect has lowered, struck in green', () => {
    const tim = byName('Feral Tim');
    const coin = render({ teddy: tim, costDelta: -1 }).querySelector('[data-cost]');
    expect(coin.textContent).toBe(String(tim.cost - 1));
    expect(coin.hasAttribute('data-discounted')).toBe(true);
    expect(coin.getAttribute('title')).toBe(`Discounted from ${tim.cost}`);
    expect(coin.getAttribute('style')).toContain('#34d399');
  });

  it('is the plain brass coin at the printed cost otherwise', () => {
    const tim = byName('Feral Tim');
    const coin = render({ teddy: tim }).querySelector('[data-cost]');
    expect(coin.textContent).toBe(String(tim.cost));
    expect(coin.hasAttribute('data-discounted')).toBe(false);
    expect(coin.hasAttribute('title')).toBe(false);
    expect(coin.getAttribute('style')).toContain('#fbbf24');
  });
});

describe('TeddyCard legibility', () => {
  // Tracked small caps under 8px render as "COMM ON" and "E PIC" at 1x: the
  // letter-spacing rounds to whole pixels. Every card, every variant.
  it('sets no text under 8px, and letter-spaces none under 8px', () => {
    for (const card of ALL_CARDS) {
      for (const variant of ['hand', 'board']) {
        for (const { el, px } of sized(render({ teddy: card, variant }))) {
          const where = `${card.name} (${variant}): ${el.getAttribute('class')}`;
          expect(px, where).toBeGreaterThanOrEqual(8);
          if (px < 8) expect(el.getAttribute('class'), where).not.toMatch(/tracking-/);
        }
      }
    }
  });

  // The art is decoration; the card owns the tap. A hit-testable <img> took
  // a long-press and opened the phone's Save Image callout.
  it('never lets the art take a tap', () => {
    for (const variant of ['hand', 'board']) {
      for (const artVariant of ['thumb', 'full', 'responsive']) {
        const img = render({ teddy: byName('Feral Tim'), variant, artVariant }).querySelector('img');
        expect(img.getAttribute('class'), `${variant}/${artVariant}`).toMatch(/(^|\s)pointer-events-none(\s|$)/);
      }
    }
  });
});
