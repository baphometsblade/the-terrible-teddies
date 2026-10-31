import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import loadConfig from 'tailwindcss/loadConfig';

// Claims against reality for the door-and-sign materials in src/index.css
// (.neon, .steel-door, .peep-slot, .note-taped). axe cannot see them: the
// sign is decoration, hidden from it, so breaking a neon's colour passes the
// a11y run (tried: a teal core of #2a3340 on night-950 stayed green). What
// guards their contrast is this: the block's comment says what was measured,
// and this recomputes every number from the live tokens and holds the
// comment to it.

const root = process.cwd();
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const config = loadConfig(resolve(root, 'tailwind.config.js'));
const colors = config.theme.extend.colors;

const BEGIN = '/* ---- After dark: the door and the bar-clock sign (package door-clock)';
const END = '/* ---- end: the door and the bar-clock sign ---- */';
const KEYFRAMES_BEGIN = '/* ---- After dark: the door and the bar-clock sign, their keyframes';
const KEYFRAMES_END = '/* ---- end: the door and the bar-clock sign, keyframes ---- */';
const between = (from, to) => {
  const start = css.indexOf(from);
  const end = css.indexOf(to, start);
  expect(start, `${from} is in index.css`).toBeGreaterThan(-1);
  expect(end, `${to} is in index.css`).toBeGreaterThan(start);
  return css.slice(start, end);
};
const materials = between(BEGIN, END);
const keyframes = between(KEYFRAMES_BEGIN, KEYFRAMES_END);
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// WCAG 2.x relative luminance and contrast.
const rgb = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
const two = (n) => n.toFixed(2);

const NIGHT_950 = rgb(colors.night[950]);
const NIGHT_900 = rgb(colors.night[900]);
// .bar-backdrop at its lightest: the amber pool at the top over the gradient's
// first stop (night-800), 16%.
const BACKDROP_TOP = over([245, 158, 11], rgb(colors.night[800]), 0.16);
const STEEL = rgb(colors.steel[700]); // the plate's lightest stop

// The dimmest a core is ever drawn, from the stylesheet itself: last call's
// flicker dips to this, and a half-lit sign rests at this.
const flickerDip = Math.min(...[...keyframes.match(/@keyframes neon-flicker[\s\S]*?\n}/)[0].matchAll(/opacity:\s*([0-9.]+)/g)].map((m) => Number(m[1])));
const halfLit = Number(/\.neon\[data-lit="half"\]\s*\{[^}]*--neon-rest:\s*([0-9.]+)/.exec(materials)[1]);

describe('the neon palette', () => {
  const TONES = ['pink', 'teal', 'amber', 'red'];

  it('has a core and a glow for each tone, in the tailwind config only', () => {
    for (const tone of TONES) {
      expect(colors.neon[tone].core, tone).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(colors.neon[tone].glow, tone).toMatch(/^#[0-9a-fA-F]{6}$/);
      // The stylesheet reads them through theme(): no second copy to drift.
      expect(materials).toContain(`theme("colors.neon.${tone}.core")`);
      expect(materials).toContain(`theme("colors.neon.${tone}.glow")`);
      expect(css.toLowerCase()).not.toContain(colors.neon[tone].core.toLowerCase());
      expect(css.toLowerCase()).not.toContain(colors.neon[tone].glow.toLowerCase());
    }
  });

  it.each(TONES)('%s: the core is 7:1 or better on the night, at full strength', (tone) => {
    const core = rgb(colors.neon[tone].core);
    expect(ratio(core, NIGHT_950)).toBeGreaterThanOrEqual(7);
    expect(ratio(core, NIGHT_900)).toBeGreaterThanOrEqual(7);
  });

  // The brief: the neon core on night-950 at 7:1 or better at its dimmest
  // flicker step, and on the lightest the backdrop gets.
  it('is 7:1 or better at the dimmest step it is ever drawn at', () => {
    expect(flickerDip).toBe(0.8);
    expect(halfLit).toBe(0.75);
    const pink = rgb(colors.neon.pink.core);
    const red = rgb(colors.neon.red.core);
    expect(ratio(over(pink, NIGHT_950, flickerDip), NIGHT_950)).toBeGreaterThanOrEqual(7);
    expect(ratio(over(pink, BACKDROP_TOP, flickerDip), BACKDROP_TOP)).toBeGreaterThanOrEqual(7);
    expect(ratio(over(red, NIGHT_950, halfLit), NIGHT_950)).toBeGreaterThanOrEqual(7);
    expect(ratio(over(red, NIGHT_900, halfLit), NIGHT_900)).toBeGreaterThanOrEqual(7);
  });

  // Every tone, at the dimmest step either dim is, so a retuned dip cannot
  // slip under for a tone the table does not use it on today.
  it.each(TONES)('%s: stays 7:1 or better at either dim, on night-950', (tone) => {
    const core = rgb(colors.neon[tone].core);
    for (const opacity of [flickerDip, halfLit]) {
      expect(ratio(over(core, NIGHT_950, opacity), NIGHT_950), `${tone} at ${opacity}`).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('the contrast the block\'s comment records', () => {
  const night = (hex, opacity) => ratio(over(rgb(hex), NIGHT_950, opacity), NIGHT_950);
  const recorded = [
    // [what, computed, the number the comment gives]
    ['pink core on night-950', ratio(rgb(colors.neon.pink.core), NIGHT_950), '15.99'],
    ['teal core on night-950', ratio(rgb(colors.neon.teal.core), NIGHT_950), '18.00'],
    ['amber core on night-950', ratio(rgb(colors.neon.amber.core), NIGHT_950), '17.28'],
    ['red core on night-950', ratio(rgb(colors.neon.red.core), NIGHT_950), '13.20'],
    ['pink at the flicker dip on night-950', night(colors.neon.pink.core, flickerDip), '10.36'],
    ['pink at the flicker dip on the backdrop top', ratio(over(rgb(colors.neon.pink.core), BACKDROP_TOP, flickerDip), BACKDROP_TOP), '7.21'],
    ['red half lit on night-950', night(colors.neon.red.core, halfLit), '7.71'],
    ['red half lit on night-900', ratio(over(rgb(colors.neon.red.core), NIGHT_900, halfLit), NIGHT_900), '7.43'],
    ['plush-100 on steel', ratio(rgb(colors.plush[100]), STEEL), '8.52'],
    ['plush-200 on steel', ratio(rgb(colors.plush[200]), STEEL), '6.55'],
    ['red-200 on steel', ratio(rgb('#fecaca'), STEEL), '7.20'],
    ['brass-300 on steel', ratio(rgb(colors.brass[300]), STEEL), '6.24'],
    ['note ink on paper', ratio(rgb('#2a2219'), rgb('#f3e9c8')), '12.90'],
  ];
  it.each(recorded)('%s', (_what, computed, written) => {
    expect(two(computed)).toBe(written);
    expect(materials, `the comment records ${written}`).toContain(written);
  });

  it('names the backdrop\'s lightest stop it measured on', () => {
    const [r, g, b] = BACKDROP_TOP.map(Math.round);
    expect(`#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`).toBe('#452f2e');
    expect(materials).toContain('#452f2e');
  });

  // A .btn-glass key on the steel, and the year field's well, are what the
  // door's controls are set on.
  it('records the key and the field at the colours they really are', () => {
    const glass = /\.btn-glass\s*\{[^}]*linear-gradient\(180deg,\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/.exec(css);
    const key = over([+glass[1], +glass[2], +glass[3]], STEEL, +glass[4]);
    expect(two(ratio(rgb(colors.plush[100]), key))).toBe('9.21');
    expect(materials).toContain('9.21');
    const door = readFileSync(resolve(root, 'src/components/TheDoor.jsx'), 'utf8');
    const alpha = Number(/bg-night-950\/(\d+)/.exec(door)[1]) / 100;
    expect(two(ratio(rgb(colors.plush[100]), over(NIGHT_950, STEEL, alpha)))).toBe('13.72');
    expect(materials).toContain('13.72');
  });
});

// The things the project's rules ask of every material, held for these four.
describe('the materials follow the rules', () => {
  const code = stripComments(materials);

  it('draws no blur over what moves', () => {
    expect(code).not.toMatch(/backdrop-filter/);
  });

  it('claims ::before for .neon alone, and no ::after, and says so at the head of the section', () => {
    expect([...code.matchAll(/([^{}]+)::(before|after)\s*\{/g)].map((m) => `${m[1].trim()}::${m[2]}`)).toEqual(['.neon::before']);
    const head = css.slice(css.indexOf('The pseudo-elements are claimed:'), css.indexOf('@layer components {'));
    const before = head.slice(head.indexOf('use ::before') - 80, head.indexOf('use ::before') + 12);
    expect(before).toContain('.neon');
    // ...and the three that claim nothing are listed as such.
    for (const name of ['.steel-door', '.peep-slot', '.note-taped']) expect(head).toContain(name);
  });

  // The door block is in the layer, so a utility can refine a material; the
  // keyframes and the rules that stop them are after it.
  it('sits in the components layer, above the combat feedback, with its keyframes below end-turn-glow', () => {
    const layerStart = css.indexOf('@layer components {');
    const layerEnd = css.indexOf('} /* end @layer components */');
    const blockAt = css.indexOf(BEGIN);
    expect(blockAt).toBeGreaterThan(layerStart);
    expect(css.indexOf(END)).toBeLessThan(layerEnd);
    expect(css.indexOf(END)).toBeLessThan(css.indexOf('.fx-float {'));
    expect(css.indexOf(KEYFRAMES_BEGIN)).toBeGreaterThan(layerEnd);
    expect(css.indexOf(KEYFRAMES_BEGIN)).toBeGreaterThan(css.indexOf('@keyframes end-turn-glow'));
  });

  // Light effects are opacity and transform only: nothing that makes the
  // browser lay out or repaint on every frame.
  it('animates opacity and transform and nothing else', () => {
    const names = ['neon-on', 'neon-on-soft', 'neon-flicker', 'peep-open', 'peep-shut', 'door-swing', 'door-spill', 'door-leave', 'door-fade'];
    for (const name of names) {
      const body = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(keyframes);
      expect(body, `@keyframes ${name}`).not.toBeNull();
      const properties = [...body[1].matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(properties.length, name).toBeGreaterThan(0);
      for (const property of properties) expect(['opacity', 'transform'], `${name} animates ${property}`).toContain(property);
    }
  });

  // Every element the block animates is stopped by the Animations switch and
  // by reduced motion.
  it('stops every animation under the Animations switch and under reduced motion', () => {
    const off = keyframes.slice(keyframes.indexOf('[data-motion="off"] .neon'), keyframes.indexOf('@media (prefers-reduced-motion'));
    const reduced = keyframes.slice(keyframes.indexOf('@media (prefers-reduced-motion'));
    for (const piece of ['.neon', '.peep-slot [data-shutter]', '.steel-door', '[data-spill]', '[data-door-stage]']) {
      expect(off, `${piece} under [data-motion="off"]`).toContain(piece);
      expect(reduced, `${piece} under prefers-reduced-motion`).toContain(piece);
    }
    // The animations themselves are the ones the keyframes define.
    for (const m of code.matchAll(/animation:\s*([a-z-]+)\s/g)) expect(keyframes, `@keyframes ${m[1]}`).toContain(`@keyframes ${m[1]}`);
  });

  // A flash is a rise and a fall. The sign switches on once with two dips in
  // 650ms, over one small sign; only last call idles, two dips in eleven
  // seconds; and red, the colour the thresholds are strictest on, fades.
  it('keeps every flash within the photosensitivity limits', () => {
    const on = /@keyframes neon-on \{([\s\S]*?)\n\}/.exec(keyframes)[1];
    // Each keyframe's opacity, in order, the lit level (var(--neon-rest)) as 1.
    const levels = [...on.matchAll(/\{\s*opacity:\s*([^;]+);/g)].map((m) => (m[1].startsWith('var(') ? 1 : Number(m[1])));
    expect(levels).toEqual([0, 0.5, 0.1, 0.9, 0.3, 1]);
    // A dip is a level below both its neighbours.
    const dips = levels.filter((l, i) => i > 0 && i < levels.length - 1 && l < levels[i - 1] && l < levels[i + 1]);
    expect(dips).toEqual([0.1, 0.3]);
    expect(/\.neon\s*\{[^}]*animation:\s*neon-on\s+(\d+)ms/.exec(materials)[1]).toBe('650');
    expect(/\.neon\[data-flicker\]\s*\{[^}]*neon-flicker\s+(\d+)s/.exec(materials)[1]).toBe('11');
    const flicker = /@keyframes neon-flicker \{([\s\S]*?)\n\}/.exec(keyframes)[1];
    expect([...flicker.matchAll(/92%, 93\.6%\s*\{\s*opacity:\s*([0-9.]+)/g)].map((m) => m[1])).toEqual(['0.8']);
    expect(/\.neon\[data-tone="red"\]\s*\{[^}]*animation:\s*neon-on-soft/.exec(materials)).not.toBeNull();
  });
});
