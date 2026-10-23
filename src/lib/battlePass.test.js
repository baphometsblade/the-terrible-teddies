import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  BATTLE_PASS_REWARDS, TRACKS, currentTier, canClaim, readyRewards, countReadyRewards,
  premiumTotals, describeGrants, passOf, listOf,
} from './battlePass';
import { ALL_CARDS } from '@/stores/gameStore';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const none = { free: [], premium: [] };

describe('the Battle Pass reward table', () => {
  it('runs tier 1..N, opening at 0 XP with strictly rising thresholds', () => {
    expect(BATTLE_PASS_REWARDS.map((r) => r.tier)).toEqual(BATTLE_PASS_REWARDS.map((_, i) => i + 1));
    expect(BATTLE_PASS_REWARDS[0].xpRequired).toBe(0);
    for (let i = 1; i < BATTLE_PASS_REWARDS.length; i++) {
      expect(BATTLE_PASS_REWARDS[i].xpRequired).toBeGreaterThan(BATTLE_PASS_REWARDS[i - 1].xpRequired);
    }
  });

  // A card reward repeats the card's name and rarity (the tile and the toasts
  // print them), so they must be the card's own.
  it("names each card reward as the catalogue does, at the card's own rarity", () => {
    for (const { tier, free, premium } of BATTLE_PASS_REWARDS) {
      for (const r of [free, premium].filter((x) => x?.type === 'card')) {
        const card = ALL_CARDS.find((c) => c.id === r.cardId);
        expect(card, `tier ${tier}: no card ${r.cardId}`).toBeTruthy();
        expect(r.name, `tier ${tier}`).toBe(card.name);
        expect(r.rarity, `tier ${tier}`).toBe(card.rarity);
      }
    }
  });

  // Each tile is drawn from its type (a card from its own art), not from a
  // platform emoji carried in the data.
  it('carries no emoji icons', () => {
    for (const row of BATTLE_PASS_REWARDS) {
      for (const track of TRACKS) expect(row[track]).not.toHaveProperty('icon');
    }
  });

  it('lives outside the dialog, so the screens that read it do not download the dialog', () => {
    for (const file of ['src/components/CardPackOpening.jsx', 'src/components/MainMenu.jsx', 'src/stores/gameStore.js', 'src/components/GameBoard/battlePassTiers.js']) {
      expect(read(file), `${file} imports the Battle Pass dialog`).not.toMatch(/from ['"](\.\/|@\/components\/)BattlePass['"]/);
    }
    expect(read('src/components/BattlePass.jsx')).not.toMatch(/(export )?const BATTLE_PASS_REWARDS\s*=/);
  });
});

describe('currentTier', () => {
  it('is the highest tier whose threshold the XP has met', () => {
    expect(currentTier(0)).toBe(1);
    for (const r of BATTLE_PASS_REWARDS) {
      expect(currentTier(r.xpRequired)).toBe(r.tier);
      if (r.xpRequired > 0) expect(currentTier(r.xpRequired - 1)).toBe(r.tier - 1);
    }
    expect(currentTier(Number.MAX_SAFE_INTEGER)).toBe(BATTLE_PASS_REWARDS.length);
  });
});

describe('what can be claimed', () => {
  const [t1, t2, t3] = BATTLE_PASS_REWARDS;

  it('needs the tier reached, the tile unclaimed, and the pass for the premium track', () => {
    const pass = { seasonXP: t2.xpRequired, claimed: none, hasPremium: false };
    expect(canClaim(pass, t2, 'free')).toBe(true);
    expect(canClaim(pass, t3, 'free')).toBe(false);
    expect(canClaim(pass, t2, 'premium')).toBe(false);
    expect(canClaim({ ...pass, hasPremium: true }, t2, 'premium')).toBe(true);
    expect(canClaim({ ...pass, claimed: { free: [t2.tier], premium: [] } }, t2, 'free')).toBe(false);
  });

  it('lists every claimable tile in tier order, free before premium', () => {
    const pass = { seasonXP: t2.xpRequired, claimed: { free: [t1.tier], premium: [] }, hasPremium: true };
    expect(readyRewards(pass).map(({ tier, track }) => `${tier}${track[0]}`)).toEqual(['1p', '2f', '2p']);
    expect(countReadyRewards(pass)).toBe(3);
  });

  it('counts nothing once everything reached is claimed', () => {
    const tiers = BATTLE_PASS_REWARDS.map((r) => r.tier);
    expect(countReadyRewards({ seasonXP: 1e9, claimed: { free: tiers, premium: tiers }, hasPremium: true })).toBe(0);
    // Without the pass the premium track never counts.
    expect(countReadyRewards({ seasonXP: 1e9, claimed: { free: tiers, premium: [] }, hasPremium: false })).toBe(0);
    expect(countReadyRewards({ seasonXP: 1e9, claimed: none, hasPremium: false })).toBe(BATTLE_PASS_REWARDS.length);
  });

  it('reads a save of any age (missing claim lists count as unclaimed)', () => {
    expect(passOf({})).toEqual({ seasonXP: 0, claimed: none, hasPremium: false });
    expect(countReadyRewards({ seasonXP: 0, claimed: {} })).toBe(1);
  });
});

describe('premiumTotals', () => {
  it('adds up what the premium track pays over a season, from the table', () => {
    const t = premiumTotals();
    const premium = BATTLE_PASS_REWARDS.map((r) => r.premium);
    const sum = (type) => premium.filter((r) => r.type === type).reduce((n, r) => n + r.amount, 0);
    expect(t.coins).toBe(sum('coins'));
    expect(t.gems).toBe(sum('gems'));
    expect(t.packs).toBe(sum('pack'));
    expect(t.cards.map((c) => c.cardId)).toEqual(premium.filter((r) => r.type === 'card').map((r) => r.cardId));
    expect(t.exclusives).toEqual(premium.filter((r) => r.type === 'exclusive').map((r) => r.name));
    expect(t.coins + t.gems + t.packs).toBeGreaterThan(0);
  });
});

describe('describeGrants', () => {
  it('totals the currencies, counts duplicate coins, and names what is new', () => {
    expect(describeGrants([
      { coins: 100 }, { packs: 1 }, { gems: 10 },
      { card: { name: 'Peeping Pete' } },
      { card: { name: 'Mama Mauls' }, alreadyOwned: true, coins: 75 },
      { cosmetic: 'Gold Border' },
      { cosmetic: 'Teddy Emote', alreadyOwned: true },
    ])).toBe('+175 coins, +10 gems, 1 card pack, Peeping Pete and Gold Border');
  });

  it('stops naming cards past three', () => {
    const cards = ['A', 'B', 'C', 'D'].map((name) => ({ card: { name } }));
    expect(describeGrants(cards)).toBe('4 new cards');
    expect(describeGrants(cards.slice(0, 3))).toBe('A, B and C');
  });

  it('is empty when nothing was handed over', () => {
    expect(describeGrants([])).toBe('');
    expect(describeGrants([{ cosmetic: 'Gold Border', alreadyOwned: true }])).toBe('');
  });

  it('joins a list the way a sentence does', () => {
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b'])).toBe('a and b');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
