import { describe, expect, it, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ALL_CARDS } from '@/stores/gameStore';
import { MORNING_AFTER_CARDS, morningAfterArtFile } from './expansionMorningAfter';
import { CARD_ART } from './cardArt';
import { ArtOrEmoji } from '@/components/TeddyCard';
import { bookOf } from '@/lib/collectionBook';
import { normalizeStars } from '@/lib/cardStars';
import { thumbUrl } from '@/lib/preloadArt';
import {
  canAttack, canSwingFace, effectiveAttack, getValidTargets, pickBlackoutTarget, readyCreatures, stampSwing,
} from '@/utils/battleUtils';
import { cardsFromIds, toGhostId } from '@/lib/social/ghostDeck';
import { deckProblem } from '@/lib/social/ladder';

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'art/fooocus-manifest.d/morning-after.json'), 'utf8'),
);

const byId = (id) => MORNING_AFTER_CARDS.find((card) => card.id === id);
const friend = { id: 'mate', type: 'action', ability: 'none', instanceId: 'mate', attack: 1, defense: 1 };

describe('Morning After cards', () => {
  const content = () => document.documentElement.dataset.content;

  afterEach(() => {
    delete document.documentElement.dataset.content;
  });

  it('registers ten unique cards the rest of the catalog can see', () => {
    expect(MORNING_AFTER_CARDS).toHaveLength(10);
    const ids = new Set(MORNING_AFTER_CARDS.map((card) => card.id));
    expect(ids.size).toBe(10);
    for (const card of MORNING_AFTER_CARDS) {
      expect(ALL_CARDS.filter((other) => other.id === card.id)).toHaveLength(1);
      expect(ALL_CARDS.filter((other) => other.name === card.name)).toHaveLength(1);
      expect(card.description).not.toMatch(/!/);
      expect(card.description.toLowerCase()).not.toMatch(/child|cub|minor|teen/);
    }
    const legendary = bookOf(ALL_CARDS, ['ma-7']).find((set) => set.id === 'legendary');
    expect(legendary.missing.some((card) => card.id === 'ma-7')).toBe(false);
    expect(legendary.owned).toBeGreaterThan(0);
    expect(normalizeStars({ 'ma-7': 2, no: 1 }, ALL_CARDS.map((card) => card.id))['ma-7']).toBe(2);
  });

  it('points every plate at the Fooocus target, and still draws without the file', async () => {
    expect(manifest).toHaveLength(10);
    const style = /adult/i;
    const bar = /neon/i;
    for (const entry of manifest) {
      const card = byId(entry.id);
      expect(card, entry.id).toBeTruthy();
      expect(entry.type).toBe('card');
      expect(entry.aspect).toBe('896*1152');
      expect(entry.target).toBe(morningAfterArtFile(entry.id));
      expect(card.art).toBe(`/${entry.target.replace(/^public\//, '')}`);
      expect(thumbUrl(entry.id)).toBe(`/cards/thumbs/${entry.id}.webp`);
      expect(entry.prompt).toMatch(style);
      expect(entry.prompt).toMatch(bar);
      expect(entry.prompt).toMatch(/amber/i);
      expect(entry.prompt).toMatch(/magenta/i);
      expect(entry.prompt).toMatch(/no children/i);
      expect(entry.prompt).toMatch(/no cubs/i);
      expect(entry.prompt).not.toMatch(/underage|teenager|loli|shota/i);
      expect(CARD_ART[entry.id]?.visual || CARD_ART[entry.id]?.scene).toBeTruthy();
    }

    const holly = byId('ma-1');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const paint = async (props) => {
      await act(async () => {
        root.render(createElement(ArtOrEmoji, props));
      });
    };

    await paint({ teddy: holly });
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/cards/thumbs/ma-1.webp');
    await paint({ teddy: holly, variant: 'full' });
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/cards/ma-1.webp');
    await paint({ teddy: holly, variant: 'responsive' });
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/cards/thumbs/ma-1.webp');
    expect(host.querySelector('img')?.getAttribute('srcset')).toContain('/cards/ma-1.webp');

    root.unmount();
    const fallback = createRoot(host);
    await act(async () => {
      fallback.render(createElement(ArtOrEmoji, { teddy: holly }));
    });
    await act(async () => {
      host.querySelector('img').dispatchEvent(new Event('error', { bubbles: false }));
    });
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/cards/ma-1.webp');
    await act(async () => {
      host.querySelector('img').dispatchEvent(new Event('error', { bubbles: false }));
    });
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toMatch(/🐻|🧸/);
    fallback.unmount();
    const gated = createRoot(host);

    document.documentElement.dataset.content = 'sfw';
    await act(async () => {
      gated.render(createElement(ArtOrEmoji, { teddy: holly }));
    });
    expect(content()).toBe('sfw');
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toMatch(/🐻|🧸/);

    gated.unmount();
    host.remove();
  });

  it('plays each effect with the engine the board already uses', () => {
    const holly = { ...byId('ma-1'), instanceId: 'holly', stealthActive: true };
    expect(getValidTargets([], [holly])).toEqual([]);
    expect(getValidTargets([], [holly, friend]).map((card) => card.instanceId)).toEqual(['mate']);

    const tess = { ...byId('ma-2'), instanceId: 'tess', hasAttacked: false };
    const swung = stampSwing(tess);
    expect(swung.pendingHangover).toBe(true);
    expect(canAttack(readyCreatures([swung])[0])).toBe(false);

    const sam = { ...byId('ma-3'), instanceId: 'sam' };
    expect(effectiveAttack(sam, [sam])).toBe(sam.attack);
    expect(effectiveAttack(sam, [sam, friend])).toBe(sam.attack + 1);

    const cara = { ...byId('ma-4'), instanceId: 'cara', summoningSick: true, hasAttacked: false };
    expect(canAttack(cara)).toBe(true);
    expect(canSwingFace(cara)).toBe(false);

    const aristotle = { ...byId('ma-5'), instanceId: 'ari' };
    expect(effectiveAttack(friend, [aristotle, friend])).toBe(friend.attack + 1);
    expect(effectiveAttack(aristotle, [aristotle, friend])).toBe(aristotle.attack);

    const brunch = byId('ma-6');
    const targets = [{ id: 'a' }, { id: 'b' }];
    expect(brunch.ability).toBe('blackout');
    expect(pickBlackoutTarget(targets, () => 0).id).toBe('a');
    expect(pickBlackoutTarget(targets, () => 0.99).id).toBe('b');

    const stella = { ...byId('ma-7'), instanceId: 'stella', hasAttacked: false };
    expect(readyCreatures([stampSwing(stella)])[0].hungover).toBe(true);

    expect(byId('ma-8')).toMatchObject({ type: 'trap', effect: 'damage', amount: 3 });
    expect(byId('ma-9')).toMatchObject({ type: 'special', effect: 'heal', amount: 4 });
    expect(byId('ma-10')).toMatchObject({ type: 'special', effect: 'draw', amount: 4 });
  });

  it('files onto the ladder as integers the deck column already accepts', () => {
    const known = new Set(ALL_CARDS.map((card) => card.id));
    const deck = ['ma-1', 'ma-1', 'ma-2', 'ma-3', 'ma-4', 'ma-5', 'ma-6', 'ma-7', 'ma-8', 'ma-9'];
    expect(deckProblem(deck, known)).toBeNull();
    expect(deck.map(toGhostId)).toEqual([151, 151, 152, 153, 154, 155, 156, 157, 158, 159]);
    for (const card of ALL_CARDS) {
      if (typeof card.id === 'number') expect(deck.map(toGhostId)).not.toContain(card.id);
    }
    const dealt = cardsFromIds([151, 'ma-2', 99999], ALL_CARDS);
    expect(dealt.map((card) => card.id)).toEqual(['ma-1', 'ma-2']);
    expect(dealt[0]).not.toBe(byId('ma-1'));
  });
});
