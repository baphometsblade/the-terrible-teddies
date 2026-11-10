import { describe, it, expect, beforeEach } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import TeddyCard from '@/components/TeddyCard';
import { ALL_CARDS, useGameStore } from '@/stores/gameStore';
import { OPPONENT_GOONS } from '@/utils/opponentDeck';
import { BOSS_CARD } from '@/lib/houseRules';
import { RARITY_ORDER } from '@/lib/rarity';
import { WARDROBE } from '@/lib/wardrobe';
import { gleamFor, wearsHolo, ringId, HOLO_FINISHES } from './cardFinish';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
// The store is read with useSyncExternalStore. A server render keeps the
// initial snapshot, so these paints go through a client root.
const render = async (teddy, props = {}) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(TeddyCard, { teddy, ...props }));
  });
  const html = host.innerHTML;
  await act(async () => { root.unmount(); });
  host.remove();
  return html;
};

const EXPANSION = /^(?:hd|ma|lo|ck|xm)-/;

describe('finish follows rarity, not a card id', () => {
  it('gleams from rare upward, and a tier below rare stays quiet', () => {
    expect(gleamFor('common')).toBeNull();
    expect(gleamFor('uncommon')).toBeNull();
    expect(gleamFor('rare')).toBe('rare');
    expect(gleamFor('epic')).toBe('epic');
    expect(gleamFor('legendary')).toBe('legendary');
    expect(gleamFor(undefined)).toBeNull();
    expect(gleamFor('nope')).toBeNull();
  });

  it('gives every catalog rarity a decision, including one added after legendary', () => {
    for (const rarity of RARITY_ORDER) {
      const gleam = gleamFor(rarity);
      expect(gleam === null || gleam === 'rare' || gleam === 'epic' || gleam === 'legendary').toBe(true);
    }
    const extended = [...RARITY_ORDER, 'mythic'];
    const index = extended.indexOf('mythic');
    expect(index).toBeGreaterThan(extended.indexOf('legendary'));
  });

  it('decides the sheen from the equipped finish alone', () => {
    expect(wearsHolo('wet-look')).toBe(true);
    expect(wearsHolo('matte')).toBe(false);
    expect(HOLO_FINISHES).toEqual(['wet-look']);
  });

  it('uses a wardrobe ring, and falls back when the id is not one', () => {
    const rings = WARDROBE.filter((item) => item.slot === 'avatar').map((item) => item.id);
    for (const id of rings) expect(ringId(id)).toBe(id);
    expect(ringId('not-a-ring')).toBe(rings[0]);
    for (const id of rings) expect(css).toContain(`data-avatar="${id}"`);
  });
});

describe('every card the game can show, expansions included', () => {
  const shown = [...ALL_CARDS, ...OPPONENT_GOONS, BOSS_CARD];

  beforeEach(() => {
    useGameStore.setState({ equippedFinish: 'wet-look', equippedAvatar: 'lipstick' });
  });

  it('finds the sets that have landed, and does not special-case their ids', () => {
    for (const prefix of ['hd-', 'ma-', 'lo-']) {
      expect(ALL_CARDS.some((card) => String(card.id).startsWith(prefix)), prefix).toBe(true);
    }
    // Chuck's Crew (ck-) and The Naughty List (xm-) are not in the catalog yet.
    // They pick up the same path the moment they are spread into ALL_CARDS.
    for (const card of shown) {
      const twin = shown.find((other) => other !== card && other.rarity === card.rarity);
      if (twin) expect(gleamFor(card.rarity), String(card.id)).toBe(gleamFor(twin.rarity));
    }
  });

  it('paints gleam, wet-look, and the profile ring from the card rarity', async () => {
    const sample = [
      ...RARITY_ORDER.map((rarity) => ALL_CARDS.find((card) => card.rarity === rarity)),
      ...ALL_CARDS.filter((card) => EXPANSION.test(String(card.id))),
      ...OPPONENT_GOONS,
      BOSS_CARD,
    ];
    for (const card of sample) {
      const html = await render(card);
      const gleam = gleamFor(card.rarity);
      if (gleam) expect(html, card.name).toContain(`data-gleam="${gleam}"`);
      else expect(html, card.name).not.toContain('data-gleam');
      expect(html, card.name).toContain('card-holo');
      expect(html, card.name).toContain('data-avatar="lipstick"');
      expect(html, card.name).toContain('card-profile-ring');
    }
  });

  it('leaves the ring off Chuck\'s cards, and the sheen off a matte finish', async () => {
    const rare = ALL_CARDS.find((card) => String(card.id).startsWith('lo-') && card.rarity === 'rare')
      || ALL_CARDS.find((card) => card.rarity === 'rare');
    useGameStore.setState({ equippedFinish: 'matte', equippedAvatar: 'high-roller' });
    const theirs = await render(rare, { wearRing: false });
    expect(theirs).toContain('data-gleam="rare"');
    expect(theirs).not.toContain('card-holo');
    expect(theirs).not.toContain('card-profile-ring');
    const ours = await render(rare);
    expect(ours).toContain('data-avatar="high-roller"');
  });
});

describe('the sheen is a transform, and it stops when motion is off', () => {
  const sweep = /@keyframes holo-sweep \{([\s\S]*?)\n\}/.exec(css)[1];

  it('moves the wet-look band with transform and opacity only', () => {
    const props = [...sweep.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) expect(['transform', 'opacity']).toContain(prop);
    expect(css).not.toContain('holo-shift');
    expect(css).not.toMatch(/@keyframes holo-sweep[\s\S]*background-position/);
  });

  it('stops the gleam and the sheen for the Animations switch and for reduced motion', () => {
    expect(css).toMatch(/\[data-motion="off"\][^{]*\.rarity-gleam/);
    expect(css).toMatch(/\[data-motion="off"\][^{]*\.card-holo::after/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)[\s\S]*\.card-holo::after[\s\S]*animation:\s*none/);
  });

  it('paints the gleam and the sheen in amber and magenta, not the old sky and purple', () => {
    const gleam = css.slice(css.indexOf('.rarity-gleam {'), css.indexOf('@keyframes rarity-gleam'));
    expect(gleam).toContain('255, 154, 44');
    expect(gleam).toContain('255, 47, 134');
    expect(gleam).not.toContain('125, 211, 252');
    expect(gleam).not.toContain('232, 121, 249');
    const holo = css.slice(css.indexOf('.card-holo {'), css.indexOf('@keyframes holo-sweep'));
    expect(holo).toContain('255, 154, 44');
    expect(holo).toContain('255, 47, 134');
  });
});
