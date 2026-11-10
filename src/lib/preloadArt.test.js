import { describe, it, expect } from 'vitest';
import { preloadCardThumbs, thumbUrl, isThumbUrl } from './preloadArt';

describe('preloading a fight\'s pictures', () => {
  it('asks only for real card thumbs, once each', () => {
    const asked = [];
    const doc = {
      createElement: () => {
        const img = {};
        Object.defineProperty(img, 'src', {
          set(value) { asked.push(value); },
        });
        return img;
      },
    };
    const urls = preloadCardThumbs([1, 1, 42, 0, 'nope', null], doc);
    expect(urls).toEqual(['/cards/thumbs/1.webp', '/cards/thumbs/42.webp']);
    expect(asked).toEqual(urls);
    expect(urls.every(isThumbUrl)).toBe(true);
  });

  it('rejects an id that is not a card', () => {
    expect(thumbUrl(3)).toBe('/cards/thumbs/3.webp');
    expect(thumbUrl(0)).toBeNull();
    expect(thumbUrl(-2)).toBeNull();
    expect(thumbUrl(1.5)).toBeNull();
    expect(thumbUrl('1')).toBe('/cards/thumbs/1.webp');
    expect(thumbUrl('ma-1')).toBe('/cards/thumbs/ma-1.webp');
    expect(isThumbUrl('/cards/thumbs/ma-1.webp')).toBe(true);
  });
});
