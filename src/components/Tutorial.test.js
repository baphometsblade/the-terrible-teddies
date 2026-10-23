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

// The tutorial describes the card a player is about to meet, so its words
// about where things sit on that card are claims about TeddyCard. They had
// drifted: the copy taught Attack as ⚔️ and HP as 🛡️ (no card draws either,
// and a shield on a card means Taunt) and called the cost "the brass gem"
// (gems are the paid currency; the cost is struck on a brass disc). Each fact
// below is read out of TeddyCard.jsx, so moving a badge fails this until the
// copy moves with it.
describe('the tutorial describes the card TeddyCard actually draws', () => {
  const card = readFileSync(resolve(process.cwd(), 'src/components/TeddyCard.jsx'), 'utf8');
  const tone = (src, name) => src.match(new RegExp(`const ${name} = '([^']+)'`))?.[1];
  const badge = (title) => {
    const m = card.match(new RegExp(`title="${title}" tone=\\{(wounded \\? \\w+ : )?(\\w+)\\} className="(left|right)-`));
    return m ? { tone: tone(card, m[2]), side: m[3], wounds: !!m[1] } : null;
  };
  const copy = [...tutorialSrc.matchAll(/content: "([^"]*)"/g)].map((m) => m[1]).join(' ');

  it('puts Attack and HP where the stat badges are, in their colours', () => {
    const attack = badge('Attack');
    const hp = badge('HP');
    expect(attack, 'could not find the Attack badge in TeddyCard — parser drift?').toBeTruthy();
    expect(hp, 'could not find the HP badge in TeddyCard — parser drift?').toBeTruthy();
    expect(copy).toMatch(new RegExp(`Attack \\{attack\\}[^.;]*bottom ${attack.side}`));
    expect(copy).toMatch(new RegExp(`HP \\{hp\\}[^.;]*bottom ${hp.side}`));
    // On the table a hurt teddy's HP badge turns red, so a board can show
    // two red badges on one card; the copy that calls HP "the blue one" has
    // to say so.
    if (hp.wounds) expect(copy).toMatch(/HP \{hp\}[^.;]*\bred\b[^.;]*\bhurt\b/);
    // The inline twins wear the badges' own faces.
    expect(tone(tutorialSrc, 'ATTACK_DISC')).toBe(attack.tone);
    expect(tone(tutorialSrc, 'HP_DISC')).toBe(hp.tone);
  });

  it('puts the cost in the corner the coin is struck in, and never calls it a gem', () => {
    const corner = card.match(/<BrassCoin[\s\S]*?className="absolute (top|bottom)-\[\d+px\] (left|right)-/);
    expect(corner, 'could not find the cost coin in TeddyCard — parser drift?').toBeTruthy();
    expect(copy).toMatch(new RegExp(`\\{cost\\}[^.]*\\b${corner[1]}-${corner[2]}\\b`));
    expect(copy).not.toMatch(/\bgem\b/i);
    // No emoji stand-ins for marks the cards and the board draw as shapes.
    expect(copy).not.toMatch(/⚔️|🛡️|⚡/u);
  });
});

// The numbers the copy quotes are the engine's numbers.
describe('the tutorial quotes the turn rules the board enforces', () => {
  const stepCopy = (title) => tutorialSrc.match(new RegExp(`title: "${title}",\\s*content: "([^"]*)"`))?.[1] ?? '';

  it('gives the first turn its real energy, and the real ceilings', async () => {
    const { energyForTurn, MAX_ENERGY, MOMENTUM_MAX } = await import('@/components/GameBoard/turn');
    const energy = stepCopy('Energy');
    expect(energy).toMatch(new RegExp(`first turn gets ${energyForTurn(1)}\\b`));
    expect(energy).toMatch(new RegExp(`up to ${MAX_ENERGY}\\b`));
    expect(stepCopy('Momentum & Rally')).toMatch(new RegExp(`gauge to ${MOMENTUM_MAX}\\b`));
  });

  it('does not teach that only big teddies block the way to Chuck', async () => {
    // Any targetable creature blocks a face attack, a 1-HP one included. The
    // copy said "Big-HP teddies are bouncers", which taught that small ones
    // could be walked past.
    const { getValidTargets } = await import('@/utils/battleUtils');
    const runt = { type: 'action', ability: 'none', attack: 1, defense: 1, currentHp: 1 };
    expect(getValidTargets([], [runt])).toHaveLength(1);
    const violence = stepCopy('Violence 101');
    expect(violence).not.toMatch(/big-HP|high-HP/i);
    expect(violence).toMatch(/every teddy[^.]*bouncer/i);
  });
});
