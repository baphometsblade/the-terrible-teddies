import { describe, it, expect } from 'vitest';
import fs, { readFileSync } from 'fs';
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

// The Leaderboard used to carry a "Rewards" tab listing Season End Rewards —
// 500 gems / 5,000 coins / 10 packs for finishing first, down to 25/250/1 for
// the top 100 — beside a live countdown of days left in the season. RANK_REWARDS
// was referenced by exactly one thing: the map that rendered it. No grant
// existed in the store, in any migration, or in either edge function, so the
// season ended and nobody was ever paid. This is the same class shopCopy.test.js
// exists to prevent, one screen over: a paid-looking promise with no code behind
// it, and this one costs the player a grind rather than a click.
describe('the leaderboard does not advertise rewards nothing grants', () => {
  // Comments stripped first: this asserts on what the component RENDERS, not on
  // what its source discusses. The comment recording why the tab was removed
  // necessarily names the copy it removed, and a guard that trips on its own
  // rationale would just teach the next person to delete the rationale.
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const leaderboard = stripComments(
    readFileSync(resolve(__dirname, './Leaderboard.jsx'), 'utf8')
  );

  it('has no rank-reward payout table', () => {
    expect(leaderboard).not.toMatch(/RANK_REWARDS\s*=/);
  });

  // Derived from the store rather than restated: if a real season-end payout is
  // ever implemented, it will grant through these, and this test should then be
  // replaced by one asserting the payout — not deleted to make room for the copy.
  it('promises no season-end payout while no grant path exists', () => {
    const store = readFileSync(resolve(__dirname, '../stores/gameStore.js'), 'utf8');
    const grantsSeasonRewards = /seasonEndReward|grantSeasonRewards|claimSeasonReward/.test(store);
    if (!grantsSeasonRewards) {
      expect(leaderboard).not.toMatch(/Season End Rewards/i);
    }
  });
});

// Settings shipped a "Music — Background music" switch that wrote a persisted
// musicEnabled flag no code has ever read, over a sounds folder containing four
// effect clips and no music. Toggling it did nothing, and could not have done
// anything. That is the same defect as a reward table with no payout: a promise
// with no implementation, differing only in that this one cost a tap instead of
// a grind.
//
// Generalised rather than pinned to that one flag: every store field a Settings
// switch binds to must be read somewhere other than the store and the Settings
// screen itself, or it controls nothing.
describe('every Settings switch controls something real', () => {
  const settings = readFileSync(resolve(__dirname, './Settings.jsx'), 'utf8');
  const srcDir = resolve(__dirname, '..');

  const readAll = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) return readAll(full);
      if (!/\.(js|jsx)$/.test(e.name) || /\.test\./.test(e.name)) return [];
      return [{ path: full, body: fs.readFileSync(full, 'utf8') }];
    });

  const files = readAll(srcDir);

  const boundFlags = [...settings.matchAll(/<Switch\s+checked=\{(\w+)\}/g)].map(([, f]) => f);

  it('finds the switches to check', () => {
    expect(boundFlags.length).toBeGreaterThan(0);
  });

  it.each(boundFlags)('%s is read outside the store and the Settings screen', (flag) => {
    const consumers = files.filter(
      (f) =>
        !/\/stores\/|Settings\.jsx$/.test(f.path) &&
        new RegExp(`\\b${flag}\\b`).test(f.body)
    );
    expect(
      consumers.map((c) => c.path.replace(srcDir, 'src')),
      `${flag} is toggled in Settings but nothing reads it`
    ).not.toHaveLength(0);
  });
});
