import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArtOrEmoji } from '@/components/TeddyCard';
import { ALL_CARDS, coinsForDuplicate } from '@/stores/gameStore';
import { RARITY_ORDER } from '@/lib/rarity';
import { ABILITY_RULES } from '@/lib/abilities';
import { CARD_ART } from '@/data/cardArt';
import { NAUGHTY_LIST_CARDS, NAUGHTY_LIST_SEASON, toLadderId, fromLadderId } from '@/data/naughtyList';
import { fromLadderId as registryFrom, toLadderId as registryTo } from '@/data/cardRegistry';
import { MAX_CARD_ID, deckProblem } from '@/lib/social/ladder';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { thumbUrl } from '@/lib/preloadArt';
import { normalizeStars, starCost } from '@/lib/cardStars';

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait|ageplay|incest|daddy|mommy|non-?consent|bestiality)\b/i;

describe('The Naughty List', () => {
  it('registers ten grown cards under xm- ids the catalog can find', () => {
    expect(NAUGHTY_LIST_CARDS).toHaveLength(10);
    expect(NAUGHTY_LIST_SEASON.card_ids).toEqual(NAUGHTY_LIST_CARDS.map((card) => card.id));
    for (const card of NAUGHTY_LIST_CARDS) {
      expect(card.id).toMatch(/^xm-[a-z0-9-]+$/);
      expect(ALL_CARDS.find((row) => row.id === card.id)).toMatchObject(card);
      expect(`${card.name} ${card.description}`).not.toMatch(BANNED);
      expect(card.description.length).toBeLessThanOrEqual(100);
      expect(ABILITY_RULES[card.ability]).toBeTruthy();
      expect(RARITY_ORDER).toContain(card.rarity);
    }
    expect(new Set(NAUGHTY_LIST_CARDS.map((card) => card.id)).size).toBe(10);
  });

  it('points each card, the banner and the background at a Fooocus plate', () => {
    const manifest = JSON.parse(readFileSync('art/fooocus-manifest.d/naughty-list.json', 'utf8'));
    expect(manifest).toHaveLength(NAUGHTY_LIST_CARDS.length + 2);
    for (const card of NAUGHTY_LIST_CARDS) {
      const entry = manifest.find((row) => row.id === card.id);
      expect(entry).toMatchObject({
        id: card.id,
        type: 'card',
        target: `public/cards/${card.id}.webp`,
        aspect: '896*1152',
      });
      expect(entry.prompt).toMatch(/adult/i);
      expect(entry.prompt).toMatch(/neon/i);
      expect(entry.prompt).toMatch(/no minors/i);
      expect(card.art).toBe(`/cards/${card.id}.webp`);
      expect(thumbUrl(card.id)).toBe(`/cards/thumbs/${card.id}.webp`);
      expect(CARD_ART[card.id].visual.length).toBeGreaterThan(0);
      expect(CARD_ART[card.id].scene.length).toBeGreaterThan(0);
    }
    const banner = manifest.find((row) => row.id === 'naughty-list-banner');
    const background = manifest.find((row) => row.id === 'naughty-list-bg');
    expect(banner).toMatchObject({ type: 'banner', aspect: '1344*768', target: 'public/seasons/naughty-list-banner.webp' });
    expect(background).toMatchObject({ type: 'background', target: 'public/seasons/naughty-list-bg.webp' });
    expect(banner.prompt).toMatch(/adult/i);
    expect(background.prompt).toMatch(/neon/i);

    document.documentElement.dataset.content = 'sfw';
    const held = renderToStaticMarkup(createElement(ArtOrEmoji, { teddy: NAUGHTY_LIST_CARDS[0] }));
    expect(held).not.toContain('<img');
    delete document.documentElement.dataset.content;
  });

  it('pays duplicates and stars, and publishes through the ladder registry', () => {
    expect(coinsForDuplicate('xm-desk')).toBe(10);
    expect(coinsForDuplicate('xm-santa')).toBe(150);
    const stars = normalizeStars({ 'xm-desk': 2, 'xm-nope': 9 }, ['xm-desk']);
    expect(stars['xm-desk']).toBe(2);
    expect(starCost('xm-desk', {}, coinsForDuplicate)).toBe(10);
    const known = new Set(ALL_CARDS.map((card) => card.id));
    const deck = NAUGHTY_LIST_CARDS.map((card) => card.id);
    expect(deckProblem(deck, known)).toBeNull();
    const wire = deck.map(registryTo);
    expect(wire).toEqual(deck.map(toLadderId));
    expect(wire.every((id) => Number.isInteger(id) && id >= 1 && id <= MAX_CARD_ID)).toBe(true);
    expect(cardsFromIds(wire, ALL_CARDS).map((card) => card.id)).toEqual(deck);
    expect(registryFrom(190)).toBe('xm-santa');
    expect(fromLadderId(190)).toBe('xm-santa');
    expect(registryFrom(200)).toBe('hd-luxe');
  });
});
