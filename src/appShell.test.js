import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

// Two boot-shell invariants that no unit test can observe (there is no React
// rendering harness here) and that regress silently in production only.

describe('every lazy-loaded screen sits inside a DialogErrorBoundary', () => {
  // Suspense catches the PENDING import promise, never a REJECTED one. A chunk
  // that fails to arrive — flaky network, or a stale hash still referenced by a
  // tab left open across a deploy — throws straight past it to the app-level
  // ErrorBoundary, which wraps everything: the whole UI, in-progress game
  // included, is replaced by the fatal crash screen because the player tapped
  // Battle. GameBoard shipped that way once; this is the guard.
  const source = read('./App.jsx');

  const lazyNames = [...source.matchAll(/const\s+(\w+)\s*=\s*lazy\(/g)].map(([, n]) => n);

  it('finds the lazy components to check (the regex still matches)', () => {
    expect(lazyNames.length).toBeGreaterThan(5);
    expect(lazyNames).toContain('GameBoard');
  });

  // Depth of open <DialogErrorBoundary> tags at each character offset.
  const depthAt = (() => {
    const events = [
      ...[...source.matchAll(/<DialogErrorBoundary\b/g)].map((m) => [m.index, +1]),
      ...[...source.matchAll(/<\/DialogErrorBoundary>/g)].map((m) => [m.index, -1]),
    ].sort((a, b) => a[0] - b[0]);
    return (offset) =>
      events.reduce((d, [at, delta]) => (at < offset ? d + delta : d), 0);
  })();

  it.each(lazyNames)('%s is rendered inside a boundary', (name) => {
    const uses = [...source.matchAll(new RegExp(`<${name}[\\s/>]`, 'g'))];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      expect(depthAt(use.index)).toBeGreaterThan(0);
    }
  });
});

describe('.teddy-drift', () => {
  const css = read('./index.css');
  const rule = css.slice(css.indexOf('.teddy-drift {'));
  const block = rule.slice(0, rule.indexOf('}'));

  // Each teddy carries its own start delay so the drift spreads out. Without a
  // backwards fill, an element renders UNTRANSFORMED for the whole delay — that
  // is, parked at `top: 0` rather than the -15vh the keyframes start from.
  // Measured at first paint before the fix: 11 of 12 teddies stacked visibly
  // along the top edge of the menu, then jumping into place one by one.
  it('fills backwards so delayed elements wait offscreen, not at the top edge', () => {
    expect(block).toMatch(/animation-fill-mode:\s*backwards/);
  });

  it('starts offscreen above the viewport', () => {
    expect(css).toMatch(/@keyframes teddy-drift[\s\S]*?from\s*{\s*transform:[^}]*-\d+vh/);
  });
});
