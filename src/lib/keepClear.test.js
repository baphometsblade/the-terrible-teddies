import { describe, it, expect, vi } from 'vitest';
import { isKeyboardFocus, revealBetween } from './keepClear';

// A card 100px tall, `top` px down the viewport.
const card = (top) => ({ top, bottom: top + 100 });
const scroller = () => ({ scrollBy: vi.fn() });

describe('revealBetween', () => {
  it('leaves a card that is already wholly in the clear', () => {
    const s = scroller();
    expect(revealBetween(card(100), 60, 700, s)).toBe(0);
    expect(s.scrollBy).not.toHaveBeenCalled();
  });

  it('scrolls a card up out from under chrome along the top', () => {
    const s = scroller();
    // Its top is 40px into a strip that ends at 60.
    expect(revealBetween(card(20), 60, 700, s)).toBe(-40);
    expect(s.scrollBy).toHaveBeenCalledWith({ top: -40, behavior: 'auto' });
  });

  it('scrolls a card down out from under chrome along the bottom', () => {
    const s = scroller();
    // Its bottom is 50px into a bar that starts at 700.
    expect(revealBetween(card(650), 60, 700, s)).toBe(50);
    expect(s.scrollBy).toHaveBeenCalledWith({ top: 50, behavior: 'auto' });
  });

  it("keeps the card's top in the clear when the band is shorter than the card", () => {
    const s = scroller();
    // An 80px band for a 100px card, the card below it: scrolled until its
    // top meets the band's, not until its bottom does (which would push the
    // top, and the card's name, under the strip).
    expect(revealBetween(card(300), 60, 140, s)).toBe(240);
  });
});

describe('isKeyboardFocus', () => {
  it('reads :focus-visible', () => {
    expect(isKeyboardFocus({ matches: (q) => q === ':focus-visible' })).toBe(true);
    expect(isKeyboardFocus({ matches: () => false })).toBe(false);
  });

  it('does nothing rather than guess where :focus-visible is not supported', () => {
    const el = { matches: () => { throw new SyntaxError('unknown pseudo-class'); } };
    expect(isKeyboardFocus(el)).toBe(false);
    expect(isKeyboardFocus(null)).toBe(false);
  });
});
