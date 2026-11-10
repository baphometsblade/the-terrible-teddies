import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArtOrEmoji } from '@/components/TeddyCard';
import { ALL_CARDS } from '@/stores/gameStore';
import { CARD_ART } from '@/data/cardArt';
import { ABILITY_RULES } from '@/lib/abilities';
import { effectRules } from '@/lib/effects';
import { thumbUrl } from '@/lib/preloadArt';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { MAX_CARD_ID, deckProblem } from '@/lib/social/ladder';
import { canAttack, effectiveAttack, resolveCreatureHit } from '@/utils/battleUtils';
import { CHUCK_CARDS, fromLadderId, toLadderId } from './chuckCrew';
import { commitBarSpecial } from '@/lib/barService';

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;
const CHUCK_LOOK = 'honey-brown adult plush bartender teddy with a barrel chest, greying muzzle, half-lidded glass eyes, loosened black bow tie, teal short-sleeve shirt unbuttoned, and one gold tooth';
const byId = (id) => CHUCK_CARDS.find((card) => card.id === id);

describe("Chuck's Crew", () => {
  it('registers ten grown cards under ck- ids the catalog can find', () => {
    expect(CHUCK_CARDS).toHaveLength(10);
    for (const card of CHUCK_CARDS) {
      expect(card.id).toMatch(/^ck-[a-z0-9-]+$/);
      expect(card.set).toBe('chuck');
      expect(ALL_CARDS.find((row) => row.id === card.id)).toMatchObject(card);
      expect(`${card.name} ${card.description}`).not.toMatch(BANNED);
      expect(card.description.length).toBeLessThanOrEqual(100);
      expect(card.description).not.toMatch(/!/);
    }
    expect(new Set(CHUCK_CARDS.map((card) => card.id)).size).toBe(10);
    expect(CHUCK_CARDS.filter((card) => card.rarity === 'legendary').map((card) => card.id)).toEqual(['ck-chuck']);
  });

  it('points each card at a Fooocus plate, and Chuck is the same bear every time', () => {
    const manifest = JSON.parse(readFileSync('art/fooocus-manifest.d/chuck.json', 'utf8'));
    expect(manifest).toHaveLength(CHUCK_CARDS.length);
    for (const card of CHUCK_CARDS) {
      const entry = manifest.find((row) => row.id === card.id);
      expect(entry).toMatchObject({
        id: card.id,
        type: 'card',
        target: `public/cards/${card.id}.webp`,
        aspect: '896*1152',
      });
      expect(entry.prompt).toMatch(/adult/i);
      // Bears follow the per-bear art direction (docs/ART_DIRECTION.md): the
      // plush guard is shared, the bar and neon are not. Object plates keep the bar.
      if (card.type === 'action') {
        expect(entry.prompt).toMatch(/stuffed plush teddy bear toy/i);
        expect(entry.prompt).toMatch(/not a human/i);
      } else {
        expect(entry.prompt).toMatch(/neon/i);
      }
      expect(entry.prompt).not.toMatch(BANNED);
      expect(card.art).toBe(`/cards/${card.id}.webp`);
      expect(thumbUrl(card.id)).toBe(card.artThumb);
      expect(CARD_ART[card.id]?.visual?.length).toBeGreaterThan(0);
      expect(CARD_ART[card.id]?.scene?.length).toBeGreaterThan(0);
    }
    for (const id of ['ck-chuck', 'ck-closing', 'ck-offduty']) {
      expect(manifest.find((row) => row.id === id).prompt).toContain(CHUCK_LOOK);
    }
  });

  it('hides the plate until the age gate opens, and falls back when the file is missing', () => {
    document.documentElement.dataset.content = '';
    const open = renderToStaticMarkup(createElement(ArtOrEmoji, { teddy: byId('ck-chuck') }));
    expect(open).toContain('src="/cards/thumbs/ck-chuck.webp"');
    document.documentElement.dataset.content = 'sfw';
    const held = renderToStaticMarkup(createElement(ArtOrEmoji, { teddy: byId('ck-chuck') }));
    expect(held).not.toContain('<img');
    expect(held).toMatch(/🧸|🐻/);
    delete document.documentElement.dataset.content;
  });

  it('publishes through integers the ladder already accepts, and deals them back', () => {
    const known = new Set(ALL_CARDS.map((card) => card.id));
    const deck = CHUCK_CARDS.map((card) => card.id);
    expect(deckProblem(deck, known)).toBeNull();
    const wire = deck.map(toLadderId);
    expect(wire).toEqual([171, 172, 173, 174, 175, 176, 177, 178, 179, 180]);
    expect(wire.every((id) => id >= 1 && id <= MAX_CARD_ID)).toBe(true);
    expect(cardsFromIds(wire, ALL_CARDS).map((card) => card.id)).toEqual(deck);
    expect(fromLadderId(171)).toBe('ck-chuck');
  });

  it('plays each of his effects through the engine', () => {
    const board = readFileSync('src/components/GameBoard/GameBoard.jsx', 'utf8');
    const utils = readFileSync('src/utils/battleUtils.js', 'utf8');
    expect(board).toContain('commitBarSpecial');
    expect(board).toContain('applyInterest');
    expect(board).toContain('tabTip');
    expect(board).toContain('pourExtra');
    expect(board).toContain('payTab');
    expect(utils).toContain('applyCutoff');
    expect(utils).toContain('ordersBonus');

    const chuck = byId('ck-chuck');
    expect(ABILITY_RULES[chuck.ability]).toMatch(/2 extra HP/);
    const closing = { ...byId('ck-closing'), instanceId: 'close' };
    expect(effectiveAttack(closing, [closing], { health: 9 })).toBe(closing.attack);
    expect(effectiveAttack(closing, [closing], { health: 5 })).toBe(closing.attack + 2);

    const off = { ...byId('ck-offduty'), attack: 2, instanceId: 'off' };
    const target = { type: 'action', attack: 1, defense: 4, currentHp: 4, ability: 'none', instanceId: 't' };
    const lived = resolveCreatureHit(off, target, [off]);
    expect(lived.survivor.hungover).toBe(true);
    expect(canAttack({ ...lived.survivor, hasAttacked: false, summoningSick: false })).toBe(false);
    const killed = resolveCreatureHit({ ...off, attack: 9 }, target, [off]);
    expect(killed.survivor).toBeNull();

    const rita = byId('ck-rita');
    const mate = { ...rita, instanceId: 'mate' };
    expect(effectiveAttack(rita, [rita])).toBe(rita.attack);
    expect(effectiveAttack(rita, [rita, mate])).toBe(rita.attack + 1);

    const top = commitBarSpecial({
      health: 20, maxHealth: 30, field: [{ type: 'action', defense: 4, currentHp: 1, instanceId: 'w' }], deck: [], hand: [],
    }, byId('ck-top-up'));
    expect(top.healed).toBe(2);
    expect(top.topped).toBe(2);

    const orders = commitBarSpecial({
      health: 4, maxHealth: 30, field: [{ type: 'action', attack: 2, instanceId: 'a' }], deck: [], hand: [],
    }, byId('ck-last-orders'));
    expect(orders.healed).toBe(6);
    expect(orders.buff).toBe(1);

    const cut = commitBarSpecial({ health: 30, maxHealth: 30, field: [], deck: [], hand: [] }, byId('ck-cut-off'));
    expect(cut.energyCut).toBe(2);

    const tab = commitBarSpecial({
      health: 30, maxHealth: 30, field: [], deck: [{ id: 1 }, { id: 2 }], hand: [], handRoom: 9,
    }, byId('ck-on-the-tab'));
    expect(tab.drawn).toBe(2);
    expect(tab.due).toBe(2);

    for (const card of CHUCK_CARDS.filter((c) => c.type !== 'action')) {
      expect(effectRules(card), card.name).toContain(String(card.amount));
    }
    expect(effectRules(byId('ck-quiet-word'))).toMatch(/loses 1 attack/);
  });
});
