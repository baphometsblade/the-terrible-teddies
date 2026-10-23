import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Progress, fillPercent, indicatorStyle } from './progress';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const render = async (props) => {
  await act(async () => { root.render(<Progress aria-label="Progress" {...props} />); });
  const bar = container.querySelector('[role="progressbar"]');
  return { bar, fill: bar.firstElementChild };
};

describe('Progress', () => {
  // The bug this pins: the fill is the track's full width slid left, so a
  // gradient on it was sized to the whole track and a low value showed only
  // the gradient's darkest end. Sized to the filled share and pinned right,
  // the visible part always carries the whole ramp.
  it.each([3, 15, 50, 85, 100])('sizes the fill background to the filled share at %i percent', async (value) => {
    const { fill } = await render({ value });
    expect(fill.style.transform).toBe(`translateX(-${100 - value}%)`);
    expect(fill.style.backgroundSize).toBe(`${value}% 100%`);
    // Pinned to the right edge (the edge that is on screen) and drawn once.
    expect(fill.className).toMatch(/\bbg-right\b/);
    expect(fill.className).toMatch(/\bbg-no-repeat\b/);
  });

  it('keeps a caller-supplied gradient on the fill (callers style it with [&>div])', async () => {
    const { bar } = await render({ value: 30, className: '[&>div]:bg-gradient-to-r' });
    expect(bar.className).toContain('[&>div]:bg-gradient-to-r');
  });

  it('clamps an out-of-range value instead of sliding off the track', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const over = await render({ value: 140 });
    expect(over.fill.style.transform).toBe('translateX(-0%)');
    expect(over.fill.style.backgroundSize).toBe('100% 100%');
    expect(over.bar.getAttribute('aria-valuenow')).toBe('100');

    const under = await render({ value: -20 });
    expect(under.fill.style.transform).toBe('translateX(-100%)');
    expect(under.bar.getAttribute('aria-valuenow')).toBe('0');
    // Radix logs an error for any value outside 0..max; clamped, it never sees one.
    expect(errors).not.toHaveBeenCalled();
  });

  it('stays indeterminate with no value, as Radix means it', async () => {
    const { bar, fill } = await render({ value: undefined });
    expect(bar.getAttribute('data-state')).toBe('indeterminate');
    expect(fill.style.transform).toBe('translateX(-100%)');
  });

  it('treats NaN as empty rather than passing it on', () => {
    expect(fillPercent(NaN)).toBe(0);
    expect(indicatorStyle(NaN)).toEqual({ transform: 'translateX(-100%)', backgroundSize: '0% 100%' });
  });
});
