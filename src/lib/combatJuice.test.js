import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { classifyHit, motionReduced, pulseImpact, strongestShake, withImpact } from './combatJuice';

describe('classifyHit', () => {
  it('leaves an ordinary chip as a quiet hit', () => {
    expect(classifyHit({ dmg: 2, killed: false, overkill: 0 })).toEqual({
      crit: false, shake: null, haptic: null,
    });
  });

  it('marks a kill or trample as a heavy crit, and a big live hit as a light one', () => {
    expect(classifyHit({ dmg: 1, killed: true, overkill: 0 }).shake).toBe('lg');
    expect(classifyHit({ dmg: 4, killed: false, overkill: 2 }).shake).toBe('lg');
    expect(classifyHit({ dmg: 5, killed: false, overkill: 0 }).shake).toBe('sm');
    expect(classifyHit({ dmg: 6, killed: false }).crit).toBe(true);
  });
});

describe('pulseImpact', () => {
  it('does nothing when motion is off, or when the browser has no vibrate', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(pulseImpact(classifyHit({ dmg: 1, killed: true }), { reduced: true })).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', {});
    expect(pulseImpact(classifyHit({ dmg: 1, killed: true }))).toBe(false);
    vi.unstubAllGlobals();
  });

  it('asks for a short pattern when vibrate exists', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    const impact = classifyHit({ dmg: 6, killed: false });
    expect(pulseImpact(impact)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(impact.haptic);
    vi.unstubAllGlobals();
  });

  it('treats a throwing vibrate as a miss', () => {
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('no'); } });
    expect(pulseImpact(classifyHit({ dmg: 1, killed: true }))).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('strongestShake', () => {
  it('lets a kill outrank a heavy chip', () => {
    const wave = strongestShake([
      withImpact({ text: '−5' }, classifyHit({ dmg: 5 })),
      withImpact({ text: '−1' }, classifyHit({ dmg: 1, killed: true })),
    ]);
    expect(wave.shake).toBe('lg');
  });
});

describe('motionReduced', () => {
  it('reads the Animations switch', () => {
    document.documentElement.dataset.motion = 'off';
    expect(motionReduced()).toBe(true);
    document.documentElement.dataset.motion = 'on';
    expect(motionReduced()).toBe(false);
    delete document.documentElement.dataset.motion;
  });
});

describe('combat feel stylesheet', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/components/GameBoard/combatFeel.css'), 'utf8');

  it('stops the board shake for the Animations switch and for reduced motion', () => {
    expect(css).toMatch(/\[data-motion="off"\][^{]*\.felt-table\[data-shake\][^{]*\{[^}]*animation:\s*none/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.felt-table\[data-shake\]\s*\{\s*animation:\s*none/);
  });
});
