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
    expect(tag).toContain('width="192"');
    expect(tag).toContain('height="256"');
    expect(tag).not.toContain('fetchpriority');
  });

  it('loads eagerly when asked, for every variant, and reserves the file’s aspect', () => {
    const expected = {
      thumb: ['width="192"', 'height="256"'],
      full: ['width="768"', 'height="1024"'],
      responsive: ['width="192"', 'height="256"'],
    };
    for (const variant of ['thumb', 'full', 'responsive']) {
      const tag = img(renderToStaticMarkup(createElement(ArtOrEmoji, { teddy, variant, loading: 'eager' })));
      expect(tag, variant).toContain('loading="eager"');
      expect(tag, variant).toContain('decoding="async"');
      // React 18 prints the DOM property name. The browser reads it as the
      // fetch priority hint either way.
      expect(tag, variant).toMatch(/fetchpriority="high"|fetchPriority="high"/);
      for (const attr of expected[variant]) expect(tag, variant).toContain(attr);
    }
  });

  it('TeddyCard passes artLoading through to its art', () => {
    expect(img(renderToStaticMarkup(createElement(TeddyCard, { teddy, artLoading: 'eager' })))).toContain('loading="eager"');
    expect(img(renderToStaticMarkup(createElement(TeddyCard, { teddy })))).toContain('loading="lazy"');
  });
});
