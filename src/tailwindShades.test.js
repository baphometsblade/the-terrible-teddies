import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join, relative } from 'path';
import loadConfig from 'tailwindcss/loadConfig';

// A Tailwind class that names a shade the palette does not define generates no
// CSS at all — no warning, no build error, nothing in the bundle. The player's
// emote bubble shipped that way: `bg-brass-100/95` over a brass palette that
// starts at 200. Its background was transparent, so near-black text sat on the
// near-black battlefield in literally the same colour as what was behind it —
// rgb(26,18,38) on rgb(26,18,38), a 1:1 contrast ratio — and its tail
// (`border-t-brass-100/95`) was missing too. axe never saw it, because no test
// opens an emote and then audits the page.
//
// This checks every use of a CUSTOM palette (night, plush, brass, felt, and the
// shadcn tokens) against the palette as Tailwind itself resolves it. Tailwind's
// built-in palettes (gray, red, purple…) are complete and are not checked.

const root = process.cwd();
// Loaded through Tailwind's own loader: the config says module.exports inside a
// "type": "module" package, which only Tailwind's loader accepts.
const config = loadConfig(resolve(root, 'tailwind.config.js'));
const colors = config.theme?.extend?.colors ?? {};
const palettes = Object.fromEntries(
  Object.entries(colors).filter(([, v]) => v && typeof v === 'object')
);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(jsx?|css)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });

const files = [...walk(resolve(root, 'src')), resolve(root, 'index.html')];

const pattern = new RegExp(
  '(?<![\\w-])(?:[a-z-]+:)*' +
    '(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|from|via|to|fill|stroke|' +
    'shadow|outline|divide|placeholder|accent|caret|decoration)-' +
    `(${Object.keys(palettes).join('|')})-(\\d+)(?:\\/\\d+)?(?![\\w-])`,
  'g'
);

// Comments are blanked, keeping their newlines so reported line numbers stay
// right. Without this the guard trips on the very comment that records the
// emote-bubble bug, which has to name the bad class to explain it.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, '$1');

const uses = files.flatMap((file) => {
  const src = stripComments(readFileSync(file, 'utf8'));
  return [...src.matchAll(pattern)].map((m) => ({
    cls: m[0],
    palette: m[1],
    shade: m[2],
    where: `${relative(root, file)}:${src.slice(0, m.index).split('\n').length}`,
  }));
});

describe('every custom-palette class names a shade the palette defines', () => {
  it('finds the palettes and their uses (the extraction still matches)', () => {
    expect(Object.keys(palettes)).toEqual(expect.arrayContaining(['night', 'plush', 'brass', 'felt']));
    expect(uses.length).toBeGreaterThan(300);
  });

  it('has no class that would silently generate nothing', () => {
    const missing = uses
      .filter((u) => !(u.shade in palettes[u.palette]))
      .map((u) => `${u.cls} at ${u.where} (${u.palette} defines ${Object.keys(palettes[u.palette]).join(', ')})`);
    expect(missing, missing.join('\n')).toEqual([]);
  });
});
