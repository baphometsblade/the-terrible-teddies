import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ALL_CARDS, SHOP_ITEMS } from '@/stores/gameStore';
import { BATTLE_PASS_REWARDS } from './BattlePass';

// Pins what the shop CLAIMS against what the economy actually does.
//
// Every assertion here derives its expectation from the live tables rather
// than restating a number, so retuning prices or drop rates fails the build
// until the player-facing copy is retuned with them. Three real mismatches
// prompted this file, all of them in paid surfaces:
//
//  - The 500-gem Premium Pass advertised "Exclusive legendary cards". Nothing
//    in the codebase marks any card exclusive; the game has four legendaries
//    and three of them are pass rewards, so a 200-coin pack could hand you one
//    and the 200-gem Legendary Pack guarantees one.
//  - "BEST VALUE" sat on the 5-pack (180 coins/pack) while the 10-pack beside
//    it was 160 coins/pack.
//  - The Drop Rates panel posted the base per-slot table unqualified next to
//    the gem tiers whose entire selling point is that their first card ignores
//    that table.
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('shop copy matches the economy it is selling', () => {
  it('does not claim card exclusivity the pack pool does not enforce', () => {
    const battlePassSrc = read('src/components/BattlePass.jsx');

    // Cards the pass hands out, and the pool openCardPack draws from.
    const passCardIds = BATTLE_PASS_REWARDS
      .flatMap((t) => [t.free, t.premium])
      .filter((r) => r?.type === 'card')
      .map((r) => r.cardId);
    expect(passCardIds.length, 'no card rewards parsed from the pass').toBeGreaterThan(0);

    // openCardPack filters ALL_CARDS by rarity alone — no exclusivity flag —
    // so every pass card with a rarity is also a possible pack pull.
    const alsoInPackPool = passCardIds.filter((id) => {
      const card = ALL_CARDS.find((c) => c.id === id);
      return card && card.rarity;
    });

    if (alsoInPackPool.length > 0) {
      expect(
        /exclusive\s+(legendary\s+)?cards?/i.test(battlePassSrc),
        `The pass advertises card EXCLUSIVITY, but ${alsoInPackPool.length} of its ` +
          `card rewards (ids ${alsoInPackPool.join(', ')}) are ordinary ALL_CARDS ` +
          `entries that openCardPack can pull from a plain pack. Either mark them ` +
          `exclusive in the pack pool, or stop calling them exclusive.`
      ).toBe(false);
    }
  });

  it('puts BEST VALUE on the tile that is actually the best value', () => {
    const packSrc = read('src/components/CardPackOpening.jsx');

    // Coins per card for each coin-priced pack tier, from the real table.
    const CARDS_PER_PACK = 5;
    const coinPacks = SHOP_ITEMS
      .filter((i) => i.type === 'pack' && i.currency === 'coins')
      .map((i) => ({ id: i.id, perCard: i.price / (i.quantity * CARDS_PER_PACK) }))
      .sort((a, b) => a.perCard - b.perCard);
    expect(coinPacks.length, 'no coin pack tiers found').toBeGreaterThanOrEqual(2);

    const best = coinPacks[0].id;
    // Find which handleBuyPack('...') tile carries the badge.
    const badged = [...packSrc.matchAll(
      /handleBuyPack\('(\w+)'\)\}\s*\n\s*badge="BEST VALUE"/g
    )].map((m) => m[1]);

    expect(
      badged,
      `BEST VALUE must sit on ${best} (${coinPacks[0].perCard} coins/card), the ` +
        `cheapest per card. Found it on: ${badged.join(', ') || 'no tile'}. ` +
        `Full ladder: ${coinPacks.map((p) => `${p.id}=${p.perCard}`).join(', ')}`
    ).toEqual([best]);
  });

  it('scopes the posted drop rates, which do not apply to guaranteed slots', () => {
    const packSrc = read('src/components/CardPackOpening.jsx');
    const storeSrc = read('src/stores/gameStore.js');

    // The guarantee branches exist, so an unqualified rate table is misleading.
    const hasGuaranteeBranch = /guaranteed\s*===\s*'legendary'/.test(storeSrc)
      && /guaranteed\s*===\s*'rare'/.test(storeSrc);
    expect(hasGuaranteeBranch, 'expected guaranteed-rarity branches in openCardPack').toBe(true);

    const heading = packSrc.match(/>Drop Rates([^<]*)</);
    expect(heading, 'Drop Rates heading not found').toBeTruthy();
    expect(
      heading[1].trim().length,
      'The Drop Rates panel is unqualified, but openCardPack gives Premium and ' +
        'Legendary packs a first card on different odds. Scope the heading ' +
        '(e.g. "— per card, standard packs") so the paid tiers are not understated.'
    ).toBeGreaterThan(0);
  });
});
