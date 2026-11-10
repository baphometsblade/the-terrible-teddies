import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArtOrEmoji } from '@/components/TeddyCard';
import { ALL_CARDS, coinsForDuplicate } from '@/stores/gameStore';
import { RARITY_ORDER } from '@/lib/rarity';
import { ABILITY_RULES } from '@/lib/abilities';
import { CARD_ART } from '@/data/cardArt';
import { HEN_DO_CARDS, toLadderId, fromLadderId } from '@/data/henDoHavoc';
import { MAX_CARD_ID, deckProblem } from '@/lib/social/ladder';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { thumbUrl } from '@/lib/preloadArt';
import { normalizeStars, starCost, nextStarTarget } from '@/lib/cardStars';
import {
  canAttack, canSwingFace, effectiveAttack, effectiveCost, damageToCreatureHp,
  pickBlackoutTarget, readyCreatures, stampSwing,
} from '@/utils/battleUtils';

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;
const ABILITIES = new Set(['none', ...Object.keys(ABILITY_RULES)]);
const byId = (id) => HEN_DO_CARDS.find((card) => card.id === id);
const friend = { id: 'ally', type: 'action', attack: 1, defense: 1, ability: 'none' };

describe('Hen Do Havoc', () => {
  it('registers ten grown cards under hd- ids the catalog can find', () => {
    expect(HEN_DO_CARDS).toHaveLength(10);
    for (const card of HEN_DO_CARDS) {
      expect(card.id).toMatch(/^hd-[a-z0-9-]+$/);
      expect(ALL_CARDS.find((row) => row.id === card.id)).toMatchObject(card);
      expect(`${card.name} ${card.description}`).not.toMatch(BANNED);
      expect(card.description.length).toBeLessThanOrEqual(100);
      expect(card.tribe).toBeUndefined();
    }
    expect(new Set(HEN_DO_CARDS.map((card) => card.id)).size).toBe(10);
  });

  it('every registered card satisfies the same shape the engine already plays', () => {
    for (const card of ALL_CARDS) {
      expect(typeof card.name).toBe('string');
      expect(card.name.length).toBeGreaterThan(0);
      expect(['action', 'trap', 'special']).toContain(card.type);
      expect(RARITY_ORDER).toContain(card.rarity);
      expect(Number.isInteger(card.cost)).toBe(true);
      expect(card.cost).toBeGreaterThanOrEqual(1);
      expect(card.cost).toBeLessThanOrEqual(8);
      expect(card.description.length).toBeGreaterThan(0);
      if (card.type === 'action') {
        expect(ABILITIES.has(card.ability)).toBe(true);
        expect(card.attack).toBeGreaterThanOrEqual(0);
        expect(card.defense).toBeGreaterThanOrEqual(1);
      }
      expect(CARD_ART[card.id]?.visual?.length).toBeGreaterThan(0);
      expect(CARD_ART[card.id]?.scene?.length).toBeGreaterThan(0);
    }
  });

  it('points each card at its Fooocus plate, and hides that plate until the age gate opens', () => {
    const manifest = JSON.parse(readFileSync('art/fooocus-manifest.d/hen-do-havoc.json', 'utf8'));
    expect(manifest).toHaveLength(HEN_DO_CARDS.length);
    for (const card of HEN_DO_CARDS) {
      const entry = manifest.find((row) => row.id === card.id);
      expect(entry).toMatchObject({
        id: card.id,
        type: 'card',
        target: `public/cards/${card.id}.webp`,
        aspect: '896*1152',
      });
      expect(entry.prompt).toMatch(/adult/i);
      // Per-bear art direction (docs/ART_DIRECTION.md): no shared bar or neon, only the plush guard.
      expect(entry.prompt).toMatch(/stuffed plush teddy bear toy/i);
      expect(entry.prompt).toMatch(/not a human/i);
      expect(card.art).toBe(`/${entry.target.replace(/^public\//, '')}`);
      expect(card.artThumb).toBe(`/cards/thumbs/${card.id}.webp`);
      expect(thumbUrl(card.id)).toBe(card.artThumb);
    }
    document.documentElement.dataset.content = '';
    const open = renderToStaticMarkup(createElement(ArtOrEmoji, { teddy: byId('hd-sash') }));
    expect(open).toContain('src="/cards/thumbs/hd-sash.webp"');
    const plate = renderToStaticMarkup(createElement(ArtOrEmoji, { teddy: byId('hd-sash'), variant: 'full' }));
    expect(plate).toContain('src="/cards/hd-sash.webp"');
    document.documentElement.dataset.content = 'sfw';
    const held = renderToStaticMarkup(createElement(ArtOrEmoji, { teddy: byId('hd-sash') }));
    expect(held).not.toContain('<img');
    expect(held).toMatch(/🧸|🐻/);
    delete document.documentElement.dataset.content;
  });

  it('pays duplicate coins and stars by the catalog id', () => {
    const sue = byId('hd-sash');
    expect(coinsForDuplicate(sue.id)).toBe(10);
    expect(coinsForDuplicate('hd-luxe')).toBe(150);
    const stars = normalizeStars({ 'hd-sash': 2, 'hd-nope': 1, 1: 9 }, ['hd-sash', 1]);
    expect(stars['hd-sash']).toBe(2);
    expect(stars['hd-nope']).toBeUndefined();
    expect(starCost(sue.id, {}, coinsForDuplicate)).toBe(10);
    const owned = HEN_DO_CARDS.filter((card) => card.rarity === 'common').map((card) => card.id);
    expect(nextStarTarget(HEN_DO_CARDS, owned, { 'hd-sash': 1 }, 'common').id).not.toBe('hd-sash');
  });

  it('publishes through an integer the ladder already accepts, and deals back', () => {
    const known = new Set(ALL_CARDS.map((card) => card.id));
    const deck = HEN_DO_CARDS.map((card) => card.id);
    expect(deckProblem(deck, known)).toBeNull();
    const wire = deck.map(toLadderId);
    expect(wire.every((id) => Number.isInteger(id) && id >= 1 && id <= MAX_CARD_ID)).toBe(true);
    expect(ALL_CARDS.some((card) => card.id === 191)).toBe(false);
    const dealt = cardsFromIds(wire, ALL_CARDS);
    expect(dealt.map((card) => card.id)).toEqual(deck);
    expect(fromLadderId(200)).toBe('hd-luxe');
    expect(toLadderId(4)).toBe(4);
  });

  it('plays each keyword through the combat rules', () => {
    const veil = { ...byId('hd-veil'), summoningSick: true };
    expect(canAttack(veil)).toBe(false);

    const shot = { ...byId('hd-shot'), summoningSick: true };
    expect(canAttack(shot)).toBe(true);
    expect(canSwingFace(shot)).toBe(false);
    expect(canSwingFace({ ...shot, summoningSick: false })).toBe(true);

    const chorus = byId('hd-chorus');
    expect(effectiveCost(chorus, [])).toBe(2);
    expect(effectiveCost(chorus, [friend])).toBe(1);

    const lola = byId('hd-lap');
    expect(lola.ability).toBe('taunt');

    const bree = byId('hd-bree');
    expect(effectiveAttack(bree, [])).toBe(4);
    expect(effectiveAttack(bree, [friend])).toBe(5);

    const honour = byId('hd-honour');
    const swung = stampSwing(honour);
    expect(swung.pendingHangover).toBe(true);
    expect(readyCreatures([swung])[0].hungover).toBe(true);
    expect(canAttack({ ...honour, hungover: true })).toBe(false);

    const petra = byId('hd-petra');
    expect(petra.ability).toBe('blackout');
    const targets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(pickBlackoutTarget(targets, () => 0).id).toBe('a');
    expect(pickBlackoutTarget(targets, () => 0.99).id).toBe('c');

    const bride = byId('hd-bride');
    const ally = { ...friend };
    expect(effectiveAttack(bride, [ally])).toBe(4);
    expect(effectiveAttack(ally, [bride])).toBe(2);

    const luxe = byId('hd-luxe');
    const hit = damageToCreatureHp({ attack: 4, ability: 'none' }, luxe);
    expect(hit).toBe(2);
    const pierced = damageToCreatureHp({ attack: 4, ability: 'piercing' }, luxe);
    expect(pierced).toBe(4);
  });
});
