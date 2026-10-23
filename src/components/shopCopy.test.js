import { describe, it, expect, afterEach } from 'vitest';
import fs, { readFileSync } from 'fs';
import { resolve } from 'path';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ALL_CARDS, SHOP_ITEMS, PACK_SLOTS, PACK_ODDS, useGameStore } from '@/stores/gameStore';
import { BATTLE_PASS_REWARDS } from './BattlePass';
import { bestValuePackId } from './StoreTile';
import CardPackOpening from './CardPackOpening';
import Shop from './Shop';

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
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Both storefronts, rendered (the Shop opens on its Card Packs tab). A real
// client render, not renderToStaticMarkup: on the server zustand reads the
// store's INITIAL state, so a balance set here would not reach the tiles.
const renderHtml = (Component) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(Component, { onClose() {} })));
  const html = host.innerHTML;
  act(() => root.unmount());
  host.remove();
  return html;
};
const renderCardPacks = () => renderHtml(CardPackOpening);
const renderShop = () => renderHtml(Shop);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The rendered tile for one item, found by its accessible name.
const tileFor = (html, item) => html.match(new RegExp(
  `<button[^>]*aria-label="Buy ${escapeRe(item.name)} for ${item.price} ${item.currency}"[^>]*>([\\s\\S]*?)</button>`
))?.[0] ?? null;
const SOLD_AS_TILES = ['pack', 'premium', 'legendary', 'coins'];

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

  // Rewritten when the tiles moved to SHOP_ITEMS: the badge used to be a
  // hand-placed JSX prop this test regex-matched; now it is computed, so the
  // test pins the computation and that both storefronts badge from it.
  it('puts BEST VALUE on the tile that is actually the best value', () => {
    // Coins per card for each coin-priced pack tier, from the real table.
    const CARDS_PER_PACK = PACK_SLOTS.regular.size;
    const coinPacks = SHOP_ITEMS
      .filter((i) => i.type === 'pack' && i.currency === 'coins')
      .map((i) => ({ id: i.id, perCard: i.price / (i.quantity * CARDS_PER_PACK) }))
      .sort((a, b) => a.perCard - b.perCard);
    expect(coinPacks.length, 'no coin pack tiers found').toBeGreaterThanOrEqual(2);

    expect(
      bestValuePackId(),
      `BEST VALUE must sit on ${coinPacks[0].id} (${coinPacks[0].perCard} coins/card). ` +
        `Full ladder: ${coinPacks.map((p) => `${p.id}=${p.perCard}`).join(', ')}`
    ).toBe(coinPacks[0].id);

    // And it follows a retune: make the single pack the cheapest per pack.
    const retuned = SHOP_ITEMS.map((i) => (i.id === 'pack_1' ? { ...i, price: 1 } : i));
    expect(bestValuePackId(retuned)).toBe('pack_1');

    // Both storefronts render exactly one badge, on that tile.
    for (const [label, html] of [['Card Packs', renderCardPacks()], ['Shop', renderShop()]]) {
      const badges = html.match(/>BEST VALUE</g) || [];
      expect(badges, `${label} should show one BEST VALUE badge`).toHaveLength(1);
      const best = SHOP_ITEMS.find((i) => i.id === bestValuePackId());
      const tile = tileFor(html, best);
      expect(tile, `${label} has no tile for ${best.id}`).toBeTruthy();
      expect(tile, `${label}'s BEST VALUE is not on ${best.id}`).toContain('>BEST VALUE<');
    }
  });

  it('scopes the posted drop rates, which do not apply to guaranteed slots', () => {
    const packSrc = read('src/components/CardPackOpening.jsx');

    // Some tier's first card rolls on its own table, so an unqualified rate
    // table is misleading. (Read from PACK_SLOTS now that the roll does; this
    // used to regex the hand-written guarantee branches it replaced.)
    const hasGuaranteedSlot = Object.values(PACK_SLOTS).some((s) => s.first !== 'standard');
    expect(hasGuaranteedSlot, 'expected a tier whose first card rolls on better odds').toBe(true);

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

// Card Packs used to hardcode a second storefront (names, copy, prices and an
// opacity-50 "can't afford" state) that had already drifted from the Shop's,
// and sold no Large Coin Bag at all. Both now render SHOP_ITEMS through one
// tile; these pin that, by rendering both.
describe('both storefronts sell SHOP_ITEMS through the same tile', () => {
  const sold = SHOP_ITEMS.filter((i) => SOLD_AS_TILES.includes(i.type));
  const saved = useGameStore.getState();
  afterEach(() => useGameStore.setState({ coins: saved.coins, gems: saved.gems }));

  it('lists every pack and coin bag in both, at the table price', () => {
    expect(sold.map((i) => i.id)).toEqual(expect.arrayContaining(['coins_small', 'coins_large']));
    for (const [label, html] of [['Card Packs', renderCardPacks()], ['Shop', renderShop()]]) {
      for (const item of sold) {
        expect(tileFor(html, item), `${label} does not sell ${item.id} at ${item.price} ${item.currency}`).toBeTruthy();
      }
    }
  });

  it('a retuned price reaches both storefronts', () => {
    const item = SHOP_ITEMS.find((i) => i.id === 'pack_5');
    const was = item.price;
    item.price = 2345;
    useGameStore.setState({ coins: 99999 });
    try {
      for (const html of [renderCardPacks(), renderShop()]) {
        expect(tileFor(html, item)).toContain('2,345');
      }
    } finally {
      item.price = was;
    }
  });

  it('Card Packs carries no price, id or affordability literal of its own', () => {
    const src = stripComments(read('src/components/CardPackOpening.jsx'));
    expect(src, 'a hardcoded price={…} prop').not.toMatch(/price=\{\s*\d/);
    expect(src, 'a hardcoded affordability check').not.toMatch(/(coins|gems)\s*>=\s*\d/);
    const ids = SHOP_ITEMS.map((i) => i.id).filter((id) => new RegExp(`['"\`]${id}['"\`]`).test(src));
    expect(ids, 'Card Packs names SHOP_ITEMS ids by hand').toEqual([]);
  });

  it('short of the price, a tile stays live and says how much more is needed', () => {
    const pack = SHOP_ITEMS.find((i) => i.id === 'pack_1');
    useGameStore.setState({ coins: pack.price - 37 });
    for (const html of [renderCardPacks(), renderShop()]) {
      const tile = tileFor(html, pack);
      expect(tile).not.toMatch(/\sdisabled(=|\s|>)/);
      expect(tile).not.toContain('opacity-50');
      expect(tile.replace(/<[^>]+>/g, '')).toContain('Need 37 more');
    }
    useGameStore.setState({ coins: pack.price });
    expect(tileFor(renderCardPacks(), pack).replace(/<[^>]+>/g, '')).not.toContain('Need');
  });

  it('the copy on each tile is true of the table', () => {
    const single = SHOP_ITEMS.find((i) => i.type === 'pack' && i.quantity === 1);
    for (const item of sold) {
      for (const copy of [item.description, item.short].filter(Boolean)) {
        // "(N% off)" / "· N% off": against N single packs bought one by one.
        const off = copy.match(/(\d+)% off/);
        if (off) {
          const real = Math.round((1 - item.price / (item.quantity * single.price)) * 100);
          expect(Number(off[1]), `${item.id}: "${copy}"`).toBe(real);
        }
        // "N cards" / "N random cards": the packs' real size.
        const cards = copy.match(/(\d+)\s+(?:random\s+)?cards/);
        if (cards) {
          const tier = { pack: 'regular', premium: 'premium', legendary: 'legendary' }[item.type];
          expect(Number(cards[1]), `${item.id}: "${copy}"`).toBe(item.quantity * PACK_SLOTS[tier].size);
        }
        // "+N coins": what the bag pays.
        const coins = copy.match(/\+([\d,]+) coins/);
        if (coins) expect(Number(coins[1].replace(/,/g, '')), `${item.id}: "${copy}"`).toBe(item.quantity);
        // A guarantee: the tier's first card rolls on nothing worse.
        const tier = { premium: 'premium', legendary: 'legendary' }[item.type];
        if (tier) {
          const first = PACK_ODDS[PACK_SLOTS[tier].first].map(([r]) => r);
          if (/rare or better/i.test(copy)) expect(first.every((r) => ['rare', 'epic', 'legendary'].includes(r))).toBe(true);
          if (/legendary/i.test(copy)) expect(first).toEqual(['legendary']);
        }
      }
    }
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
