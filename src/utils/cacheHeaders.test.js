import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// Card art used to fall through to Vercel's default (max-age=0,
// must-revalidate), so every session paid a round trip per image — and the
// pack reveal, the money moment, showed blank faces while they came in.
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
const cacheControlFor = (source) => vercel.headers
  .find((h) => h.source === source)?.headers.find((x) => x.key.toLowerCase() === 'cache-control')?.value;

describe('card art is cached', () => {
  const value = cacheControlFor('/cards/(.*)');

  it('for a day, then served stale while it revalidates', () => {
    expect(value, 'no Cache-Control for /cards/*').toBeTruthy();
    expect(Number(value.match(/max-age=(\d+)/)?.[1])).toBeGreaterThanOrEqual(86400);
    expect(value).toMatch(/stale-while-revalidate=\d+/);
  });

  // The art is regenerated under the same names (public/cards/<id>.webp), so
  // "immutable" would pin a stale picture in every browser for a year.
  it('but never as immutable, because the filenames are not content-hashed', () => {
    expect(value).not.toMatch(/immutable/);
    const names = readdirSync(resolve(process.cwd(), 'public/cards')).filter((f) => f.endsWith('.webp'));
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((f) => /^\d+\.webp$/.test(f))).toBe(true);
  });

  it('covers the paths the app actually requests art from', () => {
    const teddyCard = readFileSync(resolve(process.cwd(), 'src/components/TeddyCard.jsx'), 'utf8');
    expect(teddyCard).toContain('`/cards/thumbs/${teddy.id}.webp`');
    expect(teddyCard).toContain('`/cards/${teddy.id}.webp`');
  });

  it('leaves the hashed build assets immutable', () => {
    expect(cacheControlFor('/assets/(.*)')).toMatch(/immutable/);
  });
});
