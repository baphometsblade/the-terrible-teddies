import { describe, it, expect } from 'vitest';
import {
  preloadCardThumbs, thumbUrl, isThumbUrl, detectAvif, preferredArtFormat, resetArtFormatProbe, cardArtSources, ART_WIDTHS,
} from './preloadArt';

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
    const urls = preloadCardThumbs([1, 1, 42, 0, 'nope', 'lo-velvet', null], doc);
    expect(urls).toEqual(['/cards/thumbs/1.webp', '/cards/thumbs/42.webp', '/cards/thumbs/lo-velvet.webp']);
    expect(asked).toEqual(urls);
    expect(urls.every(isThumbUrl)).toBe(true);
  });

  it('rejects an id that is not a card', () => {
    expect(thumbUrl(3)).toBe('/cards/thumbs/3.webp');
    expect(thumbUrl(0)).toBeNull();
    expect(thumbUrl(-2)).toBeNull();
    expect(thumbUrl(1.5)).toBeNull();
    expect(thumbUrl('1')).toBe('/cards/thumbs/1.webp');
    expect(thumbUrl('lo-velvet')).toBe('/cards/thumbs/lo-velvet.webp');
    expect(thumbUrl('hd-1')).toBe('/cards/thumbs/hd-1.webp');
    expect(thumbUrl('ma-last-call')).toBe('/cards/thumbs/ma-last-call.webp');
    expect(thumbUrl('ma-1')).toBe('/cards/thumbs/ma-1.webp');
    expect(isThumbUrl('/cards/thumbs/ma-1.webp')).toBe(true);
    expect(thumbUrl('../x')).toBeNull();
    expect(thumbUrl('nope')).toBeNull();
  });
});

describe('card art formats', () => {
  // An Image stand-in whose src assignment "decodes" (or fails) at once.
  const fakeImage = (decodes) => class {
    set src(value) {
      this.width = decodes ? 1 : 0;
      queueMicrotask(() => (decodes ? this.onload?.() : this.onerror?.()));
      fakeImage.asked.push(value);
    }
  };
  fakeImage.asked = [];

  it('asks for WebP until the AVIF probe has answered, then for what the browser decodes', async () => {
    resetArtFormatProbe();
    expect(preferredArtFormat()).toBe('webp');
    expect(thumbUrl(7)).toBe('/cards/thumbs/7.webp');
    const yes = detectAvif(fakeImage(true));
    expect(detectAvif(fakeImage(true))).toBe(yes);
    await expect(yes).resolves.toBe(true);
    expect(fakeImage.asked.at(-1)).toMatch(/^data:image\/avif;base64,/);
    expect(preferredArtFormat()).toBe('avif');
    expect(thumbUrl(7)).toBe('/cards/thumbs/7.avif');
    expect(isThumbUrl('/cards/thumbs/7.avif')).toBe(true);
    expect(thumbUrl(7, 'webp')).toBe('/cards/thumbs/7.webp');
    // Answered once: a later call does not probe again.
    const before = fakeImage.asked.length;
    await expect(detectAvif(fakeImage(false))).resolves.toBe(true);
    expect(fakeImage.asked).toHaveLength(before);
    const doc = { createElement: () => ({}) };
    expect(preloadCardThumbs([3, 'ma-1'], doc)).toEqual(['/cards/thumbs/3.avif', '/cards/thumbs/ma-1.avif']);
  });

  it('keeps WebP where AVIF does not decode, or there is no Image at all', async () => {
    resetArtFormatProbe();
    await expect(detectAvif(fakeImage(false))).resolves.toBe(false);
    expect(thumbUrl(7)).toBe('/cards/thumbs/7.webp');
    resetArtFormatProbe();
    await expect(detectAvif(null)).resolves.toBe(false);
    expect(preferredArtFormat()).toBe('webp');
  });

  it('names every size and format of a card, and nothing for a non-card', () => {
    expect(cardArtSources('lo-velvet')).toEqual({
      thumb: { avif: '/cards/thumbs/lo-velvet.avif', webp: '/cards/thumbs/lo-velvet.webp' },
      mid: { avif: '/cards/mid/lo-velvet.avif', webp: '/cards/mid/lo-velvet.webp' },
      full: { webp: '/cards/lo-velvet.webp' },
    });
    expect(cardArtSources('../etc')).toBeNull();
    expect(cardArtSources(0)).toBeNull();
    expect(ART_WIDTHS).toEqual({ thumb: 192, mid: 480, full: 768 });
  });
});
