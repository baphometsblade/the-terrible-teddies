import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SAFE_INK, SAFE_MARK, SAFE_RARITIES, NIGHT_PANEL } from './raritySafe';
import { RARITY } from './rarity';

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
};

// Machado, Oliveira, Fernandes 2009, the deuteranopia matrix. Linear-ish
// sRGB is enough here: the test is "do these marks still separate", not a
// lab measurement.
const deutan = ([r, g, b]) => [
  0.367322 * r + 0.860646 * g + -0.227968 * b,
  0.280085 * r + 0.672501 * g + 0.047413 * b,
  -0.011820 * r + 0.042940 * g + 0.968881 * b,
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const lum = ([r, g, b]) => {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contrast = (fg, bg) => {
  const L1 = lum(hex(fg));
  const L2 = lum(hex(bg));
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
};

const nearestPair = (colors) => {
  let best = Infinity;
  const keys = Object.keys(colors);
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      best = Math.min(best, dist(deutan(hex(colors[keys[i]])), deutan(hex(colors[keys[j]]))));
    }
  }
  return best;
};

describe('colourblind-safe rarity', () => {
  it('covers every tier, and every ink clears AA on the night panel', () => {
    expect(SAFE_RARITIES).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
    for (const tier of SAFE_RARITIES) {
      expect(contrast(SAFE_INK[tier], NIGHT_PANEL), tier).toBeGreaterThanOrEqual(4.5);
      expect(SAFE_MARK[tier], tier).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('separates the marks under deuteranopia by more than the default palette does', () => {
    const defaults = Object.fromEntries(SAFE_RARITIES.map((tier) => [tier, RARITY[tier].hex[0]]));
    const safe = nearestPair(SAFE_MARK);
    const shipped = nearestPair(defaults);
    expect(safe).toBeGreaterThan(shipped);
    expect(safe).toBeGreaterThan(0.15);
  });

  it('is the palette the stylesheet paints, not a second set of colours', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const block = css.slice(css.indexOf('html[data-cb="safe"]'));
    expect(block.length).toBeGreaterThan(50);
    for (const hexColour of [...Object.values(SAFE_INK), ...Object.values(SAFE_MARK)]) {
      expect(block, hexColour).toContain(hexColour);
    }
  });
});
