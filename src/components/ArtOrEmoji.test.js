import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TeddyCard, { ArtOrEmoji } from './TeddyCard';

const teddy = { id: 2, name: 'Feral Tim', rarity: 'common', type: 'action', attack: 1, defense: 2, cost: 2 };
const img = (html) => html.match(/<img[^>]*>/)?.[0] ?? '';

// A pack reveal mounts a card's face the instant it turns, so a lazy image
// there waits on layout before it even starts to load; the long grids keep
// lazy. Decoding is async everywhere, so a decode never holds up a frame.
describe('ArtOrEmoji loading hints', () => {
  it('is lazy by default, and decodes off the frame', () => {
    const tag = img(renderToStaticMarkup(createElement(ArtOrEmoji, { teddy })));
    expect(tag).toContain('loading="lazy"');
    expect(tag).toContain('decoding="async"');
  });

  it('loads eagerly when asked, for every variant', () => {
    for (const variant of ['thumb', 'full', 'responsive']) {
      const tag = img(renderToStaticMarkup(createElement(ArtOrEmoji, { teddy, variant, loading: 'eager' })));
      expect(tag, variant).toContain('loading="eager"');
      expect(tag, variant).toContain('decoding="async"');
    }
  });

  it('TeddyCard passes artLoading through to its art', () => {
    expect(img(renderToStaticMarkup(createElement(TeddyCard, { teddy, artLoading: 'eager' })))).toContain('loading="eager"');
    expect(img(renderToStaticMarkup(createElement(TeddyCard, { teddy })))).toContain('loading="lazy"');
  });
});
