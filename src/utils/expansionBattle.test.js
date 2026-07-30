import { ALL_CARDS } from '@/stores/gameStore';
import { damageToCreatureHp, resolveCreatureHit, rallyField } from './battleUtils';
import { chooseOpponentPlays, chooseAttackTarget, OPPONENT_ENERGY_BY_DIFFICULTY } from './opponentAI';

// Integration-style tests for the 30-card "Barfly Expansion" (bears 50-69,
// traps 70-74, specials 75-79) against the *real* combat engine
// (battleUtils.js / opponentAI.js) — no mocks of game logic. cardSchema.test.js
// already guards the catalog's data shape; this file proves the expansion's
// numbers actually behave correctly once they're run through combat.
//
// Nothing here hardcodes the catalog size — every set of cards under test is
// derived from ALL_CARDS via filters, so this keeps working as more cards are
// added. The specific ability-role ids (shield/piercing/fury bears) are named
// directly because the task/design calls out exactly which cards carry those
// roles; that isn't a size assumption.

const EXPANSION_MIN_ID = 50;

const expansionCards = ALL_CARDS.filter((c) => c.id >= EXPANSION_MIN_ID);
const expansionActionCards = expansionCards.filter((c) => c.type === 'action');
const expansionTrapCards = expansionCards.filter((c) => c.type === 'trap');
const expansionSpecialCards = expansionCards.filter((c) => c.type === 'special');

const originalCards = ALL_CARDS.filter((c) => c.id < EXPANSION_MIN_ID);
const originalPlainActionCards = originalCards.filter(
  (c) => c.type === 'action' && c.ability === 'none'
);

const label = (card) => `card "${card?.name}" (id: ${card?.id})`;

// A neutral, ability-less opponent from the original catalog, so expansion
// cards get exercised against a stable, unsurprising combatant.
const plainOpponent = originalPlainActionCards[0];

// `withHp` mirrors GameBoard.jsx's own `withHp` helper: a card enters the
// board with `currentHp` seeded from its `defense` pool.
const withHp = (card) => ({ ...card, currentHp: card.defense });

const findOriginal = (predicate, description) => {
  const found = originalPlainActionCards.find(predicate);
  expect(found, `expected an original ability-less action card ${description}`).toBeDefined();
  return found;
};

describe('expansion catalog sanity', () => {
  it('has expansion action, trap, and special cards to exercise', () => {
    expect(expansionActionCards.length, 'expected at least one expansion action card').toBeGreaterThan(0);
    expect(expansionTrapCards.length, 'expected at least one expansion trap card').toBeGreaterThan(0);
    expect(expansionSpecialCards.length, 'expected at least one expansion special card').toBeGreaterThan(0);
  });

  it('found a neutral ability-less original action card to use as an opponent', () => {
    expect(plainOpponent, 'expected an ability-less original action card to exist').toBeDefined();
  });
});

describe('every expansion action card attacks and is attacked cleanly', () => {
  for (const card of expansionActionCards) {
    it(`${label(card)} produces only well-formed, non-negative results in both directions`, () => {
      const assertWellFormed = (attacker, target, dmgAssertLabel) => {
        const { survivor, overkill, dmg } = resolveCreatureHit(attacker, target);

        expect(Number.isInteger(dmg), `${dmgAssertLabel}: dmg (${dmg}) must be an integer`).toBe(true);
        expect(dmg, `${dmgAssertLabel}: dmg (${dmg}) must be >= 0`).toBeGreaterThanOrEqual(0);

        if (survivor !== null) {
          expect(
            Number.isInteger(survivor.currentHp),
            `${dmgAssertLabel}: surviving currentHp (${survivor.currentHp}) must be an integer`
          ).toBe(true);
          expect(
            survivor.currentHp,
            `${dmgAssertLabel}: surviving currentHp (${survivor.currentHp}) must be > 0`
          ).toBeGreaterThan(0);
        } else {
          expect(Number.isInteger(overkill), `${dmgAssertLabel}: overkill (${overkill}) must be an integer`).toBe(true);
          expect(overkill, `${dmgAssertLabel}: overkill (${overkill}) must be >= 0`).toBeGreaterThanOrEqual(0);
        }
      };

      // Card attacks the neutral opponent.
      assertWellFormed(withHp(card), withHp(plainOpponent), `${label(card)} attacking ${label(plainOpponent)}`);

      // Neutral opponent attacks the card.
      assertWellFormed(withHp(plainOpponent), withHp(card), `${label(plainOpponent)} attacking ${label(card)}`);
    });
  }
});

describe('shield halving and piercing bypass', () => {
  const shieldBearIds = [60, 64, 69];
  const piercingBearIds = [57, 65];

  const findExpansionCard = (id) => {
    const card = expansionActionCards.find((c) => c.id === id);
    expect(card, `expected expansion catalog to contain card id ${id}`).toBeDefined();
    return card;
  };

  const shieldBears = shieldBearIds.map(findExpansionCard);
  const piercingBears = piercingBearIds.map(findExpansionCard);

  it('sanity: every configured shield bear actually has ability "shield"', () => {
    for (const bear of shieldBears) {
      expect(bear.ability, `${label(bear)} was expected to carry the "shield" ability`).toBe('shield');
    }
  });

  it('sanity: every configured piercing bear actually has ability "piercing"', () => {
    for (const bear of piercingBears) {
      expect(bear.ability, `${label(bear)} was expected to carry the "piercing" ability`).toBe('piercing');
    }
  });

  for (const shieldBear of shieldBears) {
    it(`${label(shieldBear)} halves incoming damage from a non-piercing attacker (floor(attack/2))`, () => {
      const expectedDmg = Math.floor(plainOpponent.attack / 2);
      const dmg = damageToCreatureHp(plainOpponent, shieldBear);
      expect(dmg, `${label(shieldBear)} should take floor(${plainOpponent.attack}/2) = ${expectedDmg} damage, got ${dmg}`).toBe(expectedDmg);

      const { dmg: resolvedDmg } = resolveCreatureHit(withHp(plainOpponent), withHp(shieldBear));
      expect(resolvedDmg, `resolveCreatureHit should agree with damageToCreatureHp for ${label(shieldBear)}`).toBe(expectedDmg);
    });

    for (const piercingBear of piercingBears) {
      it(`${label(piercingBear)} (piercing) bypasses ${label(shieldBear)}'s shield entirely`, () => {
        const dmg = damageToCreatureHp(piercingBear, shieldBear);
        expect(
          dmg,
          `${label(piercingBear)} should deal its full ${piercingBear.attack} attack to shielded ${label(shieldBear)}, not a halved amount, got ${dmg}`
        ).toBe(piercingBear.attack);
      });
    }
  }
});

describe('fury bears gain +1 attack only when they survive', () => {
  const furyBearIds = [58, 62, 68];

  const furyBears = furyBearIds.map((id) => {
    const card = expansionActionCards.find((c) => c.id === id);
    expect(card, `expected expansion catalog to contain card id ${id}`).toBeDefined();
    return card;
  });

  it('sanity: every configured fury bear actually has ability "fury"', () => {
    for (const bear of furyBears) {
      expect(bear.ability, `${label(bear)} was expected to carry the "fury" ability`).toBe('fury');
    }
  });

  for (const furyBear of furyBears) {
    it(`${label(furyBear)} gains exactly +1 attack when it survives a hit, and none when killed`, () => {
      const weakAttacker = findOriginal(
        (c) => c.attack < furyBear.defense,
        `with attack under ${furyBear.defense} (so it can't kill ${label(furyBear)})`
      );
      const lethalAttacker = findOriginal(
        (c) => c.attack >= furyBear.defense,
        `with attack at least ${furyBear.defense} (so it can kill ${label(furyBear)})`
      );

      // Survives: +1 attack, exactly.
      const survived = resolveCreatureHit(withHp(weakAttacker), withHp(furyBear));
      expect(survived.survivor, `${label(furyBear)} was expected to survive a hit from ${label(weakAttacker)}`).not.toBeNull();
      expect(
        survived.survivor.attack,
        `${label(furyBear)} should gain exactly +1 attack (${furyBear.attack} -> ${furyBear.attack + 1}) on survival`
      ).toBe(furyBear.attack + 1);

      // Killed: no survivor to gain anything.
      const died = resolveCreatureHit(withHp(lethalAttacker), withHp(furyBear));
      expect(died.survivor, `${label(furyBear)} was expected to die to a lethal hit from ${label(lethalAttacker)}`).toBeNull();
      expect(died.overkill, 'overkill must be an integer >= 0').toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(died.overkill)).toBe(true);
    });
  }
});

describe('rallyField over expansion creatures + an expansion trap', () => {
  it('gives every expansion action card +1 attack and restores currentHp to defense, leaving the trap untouched', () => {
    // A small, mixed field: a plain bear, a shield bear, a fury bear, all
    // pre-damaged, plus one untouched expansion trap.
    const plainBear = expansionActionCards.find((c) => c.ability === 'none');
    const shieldBear = expansionActionCards.find((c) => c.id === 60);
    const furyBear = expansionActionCards.find((c) => c.id === 58);
    const trap = expansionTrapCards[0];

    expect(plainBear, 'expected an ability-less expansion action card').toBeDefined();
    expect(shieldBear, 'expected expansion shield bear id 60').toBeDefined();
    expect(furyBear, 'expected expansion fury bear id 58').toBeDefined();
    expect(trap, 'expected at least one expansion trap card').toBeDefined();

    const damaged = (card) => ({ ...card, currentHp: 1 }); // pre-damaged, well below defense

    const field = [damaged(plainBear), damaged(shieldBear), damaged(furyBear), { ...trap }];

    const rallied = rallyField(field);

    const [rPlain, rShield, rFury, rTrap] = rallied;

    expect(rPlain.attack, `${label(plainBear)} should gain +1 attack from rally`).toBe(plainBear.attack + 1);
    expect(rPlain.currentHp, `${label(plainBear)} should be healed to its defense (${plainBear.defense})`).toBe(plainBear.defense);

    expect(rShield.attack, `${label(shieldBear)} should gain +1 attack from rally`).toBe(shieldBear.attack + 1);
    expect(rShield.currentHp, `${label(shieldBear)} should be healed to its defense (${shieldBear.defense})`).toBe(shieldBear.defense);

    expect(rFury.attack, `${label(furyBear)} should gain +1 attack from rally`).toBe(furyBear.attack + 1);
    expect(rFury.currentHp, `${label(furyBear)} should be healed to its defense (${furyBear.defense})`).toBe(furyBear.defense);

    // The trap is a non-'action' type and rallyField leaves it untouched.
    expect(rTrap, `${label(trap)} (a trap) must be untouched by rallyField`).toEqual(trap);
  });
});

describe('chooseOpponentPlays with an expansion-only deck', () => {
  // The full expansion (actions + traps + specials) as a deck, matching how
  // a real deck mixes card types.
  const expansionDeck = expansionCards;

  const scenarios = [
    { fieldCount: 0, energy: OPPONENT_ENERGY_BY_DIFFICULTY.easy },
    { fieldCount: 0, energy: OPPONENT_ENERGY_BY_DIFFICULTY.normal },
    { fieldCount: 0, energy: OPPONENT_ENERGY_BY_DIFFICULTY.hard },
    { fieldCount: 2, energy: OPPONENT_ENERGY_BY_DIFFICULTY.hard },
  ];

  for (const { fieldCount, energy } of scenarios) {
    it(`respects the energy budget (${energy}) and 3-slot field cap when fieldCount=${fieldCount}`, () => {
      const { plays, remainingDeck } = chooseOpponentPlays(expansionDeck, fieldCount, energy);

      const totalCost = plays.reduce((sum, c) => sum + (c.cost ?? 0), 0);
      expect(totalCost, `sum of played costs (${totalCost}) must not exceed the energy budget (${energy})`).toBeLessThanOrEqual(energy);

      expect(
        fieldCount + plays.length,
        `field (${fieldCount} existing + ${plays.length} played) must not exceed the 3-slot cap`
      ).toBeLessThanOrEqual(3);

      for (const played of plays) {
        expect(expansionDeck, `played card ${label(played)} must come from the input deck`).toContain(played);
      }

      // Every card is accounted for: split between plays and remainingDeck.
      expect(plays.length + remainingDeck.length).toBe(expansionDeck.length);
    });
  }

  it('never invents a card absent from the input deck, even with a generous budget', () => {
    const smallDeck = expansionActionCards.slice(0, 4);
    const { plays } = chooseOpponentPlays(smallDeck, 0, 99);
    for (const played of plays) {
      expect(smallDeck, `played card ${label(played)} must be one of the ${smallDeck.length} decklist cards`).toContain(played);
    }
  });
});

describe('chooseAttackTarget with expansion creatures', () => {
  it('returns one of the provided expansion targets', () => {
    const targets = expansionActionCards.slice(0, 5).map(withHp);
    const attacker = withHp(expansionActionCards.find((c) => c.id === 65)); // The Debt Collector (piercing)

    const chosen = chooseAttackTarget(targets, attacker);
    expect(targets, 'chooseAttackTarget must return one of the supplied targets').toContain(chosen);
  });

  it('also returns one of the targets in legacy mode (no attacker supplied)', () => {
    const targets = expansionActionCards.slice(5, 10).map(withHp);
    const chosen = chooseAttackTarget(targets);
    expect(targets, 'chooseAttackTarget (legacy mode) must return one of the supplied targets').toContain(chosen);
  });
});

describe('battle loop sanity: rounds resolve to termination without invalid HP', () => {
  it('alternating attacks between two small expansion fields always terminates with one side defeated', () => {
    // Deliberately avoid shield-ability targets here so every hit deals
    // strictly positive damage (floor(attack/2) could be 0 for a 1-attack
    // non-piercing attacker vs. a shield target) — this test is about loop
    // termination and HP-invariant safety, not shield mechanics (covered
    // separately above).
    const nonShieldExpansionActions = expansionActionCards.filter((c) => c.ability !== 'shield');
    expect(nonShieldExpansionActions.length, 'expected at least 4 non-shield expansion action cards').toBeGreaterThanOrEqual(4);

    let sideA = nonShieldExpansionActions.slice(0, 2).map(withHp);
    let sideB = nonShieldExpansionActions.slice(2, 4).map(withHp);

    const MAX_ITERATIONS = 1000;
    let iterations = 0;

    while (sideA.length > 0 && sideB.length > 0 && iterations < MAX_ITERATIONS) {
      const attackerSide = iterations % 2 === 0 ? sideA : sideB;
      const defenderSide = iterations % 2 === 0 ? sideB : sideA;

      const attacker = attackerSide[0];
      const defender = defenderSide[0];
      const { survivor, overkill, dmg } = resolveCreatureHit(attacker, defender);

      expect(Number.isInteger(dmg) && dmg >= 0, `round ${iterations}: dmg (${dmg}) must be a non-negative integer`).toBe(true);

      if (survivor !== null) {
        expect(
          Number.isInteger(survivor.currentHp) && survivor.currentHp > 0,
          `round ${iterations}: ${label(defender)} survivor currentHp (${survivor.currentHp}) must be a positive integer, never <= 0`
        ).toBe(true);
        defenderSide[0] = survivor;
      } else {
        expect(
          Number.isInteger(overkill) && overkill >= 0,
          `round ${iterations}: ${label(defender)} died but overkill (${overkill}) must be a non-negative integer`
        ).toBe(true);
        defenderSide.shift();
      }

      iterations += 1;
    }

    expect(
      iterations,
      `battle loop did not terminate within ${MAX_ITERATIONS} rounds — possible infinite loop in the combat model`
    ).toBeLessThan(MAX_ITERATIONS);
    expect(
      sideA.length === 0 || sideB.length === 0,
      'battle loop ended without either side being fully defeated'
    ).toBe(true);
  });
});
