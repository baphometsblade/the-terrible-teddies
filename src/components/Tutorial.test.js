import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ALL_CARDS } from '@/stores/gameStore';

// Pins the tutorial's teaching against the engine it teaches.
//
// The tutorial is the only place a new player is told the rules, and it is
// static prose sitting a long way from the code it describes — so it rots
// silently every time a mechanic ships. It had drifted three ways at once:
// it taught 5 of the engine's 8 abilities (protect, swarm and royal shipped on
// obtainable cards and were never mentioned), it described Fury as an
// unbounded +1 per survived hit when battleUtils caps stacks at +3, and it
// promised Piercing as a second route to hitting Chuck's face past blockers,
// which the engine has never implemented — piercing only negates Shield's
// damage halving.
//
// Nothing caught any of it: no test reads Tutorial.jsx, and prose can't fail
// a type check. These assertions are deliberately coarse — they check that a
// mechanic is MENTIONED, not how it is worded — so the jokes stay free to
// change while the coverage claim stays honest.
// Normalise the escaped newlines the JSX strings use as line breaks. Left
// raw, a word following a literal \n sits immediately after the letter 'n',
// so /\bFury\b/ finds no word boundary and the guard reports a mechanic as
// missing when it is right there in the copy.
const tutorialSrc = readFileSync(resolve(process.cwd(), 'src/components/Tutorial.jsx'), 'utf8')
  .replace(/\\n/g, ' ');

describe('the tutorial teaches the engine that actually ships', () => {
  it('names every ability a player can actually draw', () => {
    // Derived from the catalog, not a hardcoded list: a new ability on a real
    // card fails this the moment it ships without a tutorial line.
    const shipped = [...new Set(
      ALL_CARDS.map((c) => c.ability).filter((a) => a && a !== 'none')
    )].sort();
    expect(shipped.length, 'no abilities found in ALL_CARDS — parser drift?')
      .toBeGreaterThanOrEqual(5);

    const missing = shipped.filter(
      (a) => !new RegExp(`\\b${a}\\b`, 'i').test(tutorialSrc)
    );
    expect(
      missing,
      `Cards in the catalog carry these abilities, but the tutorial never ` +
        `mentions them: ${missing.join(', ')}. A player meets the mechanic ` +
        `mid-battle with no idea what it does.`
    ).toEqual([]);
  });

  it('does not promise Piercing as a way past blockers', () => {
    // Piercing only bypasses Shield's halving (battleUtils resolveCreatureHit).
    // Target selection never consults the attacker, and the face attack is
    // refused while any valid creature target remains — piercing included.
    const sentences = tutorialSrc.split(/(?<=[.!?])\s+/);
    const offenders = sentences.filter(
      (s) => /piercing/i.test(s) && /\b(past|through|around)\b/i.test(s) && /\b(bouncer|blocker|directly|face)\b/i.test(s)
        && !/does NOT|doesn't|never/i.test(s)
    );
    expect(
      offenders,
      `The tutorial implies Piercing gets you past blockers to Chuck's face. ` +
        `It does not — it only cuts through Shield:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  it('does not state a fixed HP for Chuck, whose health scales with difficulty', () => {
    // Opponent health is 30 + healthMod (-5 easy / 0 normal / +5 hard), so any
    // concrete "his NN HP" is wrong on two of the three difficulties.
    const claims = [...tutorialSrc.matchAll(/his\s+(\d+)\s*HP/gi)].map((m) => m[0]);
    expect(
      claims,
      `The tutorial states a fixed HP for Chuck (${claims.join(', ')}), but his ` +
        `health is difficulty-scaled to 25 / 30 / 35.`
    ).toEqual([]);
  });
});
