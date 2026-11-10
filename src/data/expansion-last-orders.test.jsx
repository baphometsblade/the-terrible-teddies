import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { LAST_ORDERS_CARDS, artTargetFor, toLadderId, fromLadderId } from './expansion-last-orders';
import { LAST_ORDERS_ART } from './lastOrdersArt';
import { ALL_CARDS } from '@/stores/gameStore';
import { CARD_ART } from '@/data/cardArt';
import { RARITY_ORDER } from '@/lib/rarity';
import { bookOf } from '@/lib/collectionBook';
import { normalizeStars } from '@/lib/cardStars';
import { deckProblem } from '@/lib/social/ladder';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { resolveCrew } from '@/lib/dailyFight';
import { ArtOrEmoji } from '@/components/TeddyCard';
import { hasLastOrdersArt } from '@/components/LastOrdersArt';
import {
  canAttack, canSwingFace, effectiveAttack, effectiveCost, getValidTargets,
  damageToCreatureHp, pickBlackoutTarget, readyCreatures, resolveCreatureHit, stampSwing,
} from '@/utils/battleUtils';

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;

const byId = (id) => LAST_ORDERS_CARDS.find((card) => card.id === id);
const withHp = (card) => ({ ...card, currentHp: card.defense });
const friend = { id: 'friend', type: 'action', attack: 1, defense: 1, ability: 'none' };

afterEach(() => {
  delete document.documentElement.dataset.content;
});

describe('Last Orders cards', () => {
  it('registers ten new adults and keeps every id unique across the catalog', () => {
    expect(LAST_ORDERS_CARDS).toHaveLength(10);
    const seen = new Set();
    for (const card of ALL_CARDS) {
      expect(seen.has(card.id), `duplicate id ${card.id}`).toBe(false);
      seen.add(card.id);
    }
    expect(seen.size).toBe(ALL_CARDS.length);
    for (const card of LAST_ORDERS_CARDS) {
      expect(ALL_CARDS.find((row) => row.id === card.id)).toMatchObject(card);
      expect(card.id.startsWith('lo-')).toBe(true);
      expect(`${card.name} ${card.description}`).not.toMatch(BANNED);
      expect(card.description.includes('!')).toBe(false);
      expect(card.description.length).toBeLessThanOrEqual(100);
    }
  });

  it('uses a ladder alias the integer column can store, with no collisions', () => {
    const aliases = LAST_ORDERS_CARDS.map((card) => card.ladderId);
    expect(new Set(aliases).size).toBe(aliases.length);
    const taken = new Set(ALL_CARDS.map((card) => card.id));
    for (const alias of aliases) {
      expect(alias).toBeGreaterThanOrEqual(161);
      expect(alias).toBeLessThanOrEqual(170);
      expect(taken.has(alias)).toBe(false);
    }
  });

  it('is obtainable from packs, the collection book, nights out, and a published deck', () => {
    for (const card of LAST_ORDERS_CARDS) {
      expect(RARITY_ORDER.includes(card.rarity), card.name).toBe(true);
      expect(ALL_CARDS.some((row) => row.rarity === card.rarity && row.id === card.id)).toBe(true);
      const row = bookOf(ALL_CARDS, []).find((set) => set.id === card.rarity);
      expect(row.missing.some((member) => member.id === card.id)).toBe(true);
      expect(CARD_ART[card.id]).toEqual(LAST_ORDERS_ART[card.id]);
      expect(hasLastOrdersArt(card.id)).toBe(true);
    }
    const hard = ALL_CARDS.filter((card) => card.type === 'action' && ['rare', 'epic', 'legendary'].includes(card.rarity));
    expect(hard.some((card) => card.id === 'lo-owners-round')).toBe(true);
    expect(resolveCrew({ cards: [161, 'lo-lights-down'] }, ALL_CARDS).map((card) => card.id)).toEqual([
      'lo-velvet-rope',
      'lo-lights-down',
    ]);
    const stars = normalizeStars({ 'lo-velvet-rope': 2, 1: 1 }, ALL_CARDS.map((card) => card.id));
    expect(stars['lo-velvet-rope']).toBe(2);
    const ghost = cardsFromIds([161, 'lo-firm-hand', 999], ALL_CARDS);
    expect(ghost.map((card) => card.id)).toEqual(['lo-velvet-rope', 'lo-firm-hand']);
    expect(ghost[0]).not.toBe(byId('lo-velvet-rope'));
    const ids = ['lo-velvet-rope', 1, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(deckProblem(ids, new Set(ids))).toBeNull();
    expect(ids.map((id) => toLadderId(id))).toEqual([161, 1, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(fromLadderId(170)).toBe('lo-owners-round');
  });

  it('points every card at its Fooocus plate and hides that picture while the gate is shut', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'art/fooocus-manifest.d/last-orders.json'), 'utf8'));
    expect(manifest).toHaveLength(LAST_ORDERS_CARDS.length);
    for (const card of LAST_ORDERS_CARDS) {
      const entry = manifest.find((row) => row.id === card.id);
      expect(entry?.type, card.name).toBe('card');
      expect(entry.aspect).toBe('896*1152');
      expect(entry.target).toBe(artTargetFor(card.id));
      expect(entry.prompt).toMatch(/adult/i);
      expect(entry.prompt).toMatch(/neon/i);
      expect(entry.prompt).not.toMatch(BANNED);
    }
    document.documentElement.dataset.content = 'nsfw';
    const open = renderToStaticMarkup(<ArtOrEmoji teddy={byId('lo-velvet-rope')} />);
    expect(open).toContain('src="/cards/thumbs/lo-velvet-rope.webp"');
    document.documentElement.dataset.content = 'sfw';
    const shut = renderToStaticMarkup(<ArtOrEmoji teddy={byId('lo-velvet-rope')} />);
    expect(shut).not.toContain('<img');
    expect(shut).not.toContain('<svg');
  });

  it('Vera must be hit before anyone behind the rope', () => {
    const vera = byId('lo-velvet-rope');
    const targets = getValidTargets([], [vera, friend]);
    expect(targets).toEqual([vera]);
  });

  it('Tess is cheaper once another bear is already at the table', () => {
    const tess = byId('lo-two-for-one');
    expect(effectiveCost(tess, [])).toBe(tess.cost);
    expect(effectiveCost(tess, [friend])).toBe(tess.cost - 1);
  });

  it('Lola can swing a bear the turn she arrives, and not a face', () => {
    const lola = { ...byId('lo-last-pour'), summoningSick: true };
    expect(canAttack(lola)).toBe(true);
    expect(canSwingFace(lola)).toBe(false);
  });

  it('Hope hits harder with company and no harder alone', () => {
    const hope = byId('lo-on-the-house');
    expect(effectiveAttack(hope, [hope])).toBe(hope.attack);
    expect(effectiveAttack(hope, [hope, friend])).toBe(hope.attack + 1);
  });

  it('Frankie halves a hit, and Cole cuts straight through him', () => {
    const frankie = byId('lo-firm-hand');
    const cole = byId('lo-cut-the-line');
    const swinger = { attack: 4, ability: 'none' };
    expect(damageToCreatureHp(swinger, frankie)).toBe(2);
    expect(damageToCreatureHp(cole, frankie)).toBe(cole.attack);
  });

  it('Mack sits the next turn out after he throws someone', () => {
    const mack = byId('lo-sorry-mate');
    const spent = stampSwing(mack);
    expect(spent.pendingHangover).toBe(true);
    const [sat] = readyCreatures([spent]);
    expect(sat.hungover).toBe(true);
    expect(canAttack(sat)).toBe(false);
  });

  it('Dana picks the target herself', () => {
    const bears = [{ id: 'a' }, { id: 'b' }];
    expect(pickBlackoutTarget(bears, () => 0).id).toBe('a');
    expect(pickBlackoutTarget(bears, () => 0.99).id).toBe('b');
  });

  it('Sal gets meaner each time she is still standing', () => {
    const sal = withHp(byId('lo-still-standing'));
    const { survivor } = resolveCreatureHit({ attack: 1, ability: 'none' }, sal);
    expect(survivor.attack).toBe(sal.attack + 1);
    expect(survivor.furyStacks).toBe(1);
  });

  it("the owner's round makes the rest of the table meaner, not him", () => {
    const owner = byId('lo-owners-round');
    const field = [owner, friend];
    expect(effectiveAttack(friend, field)).toBe(friend.attack + 1);
    expect(effectiveAttack(owner, field)).toBe(owner.attack);
  });
});
