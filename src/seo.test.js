import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const read = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8');

// The age gate is a courtesy in the app. Crawlers do not pass it, so the
// page itself has to say what it is, and the pictures have to be off limits.
describe('age-gate metadata', () => {
  const html = read('index.html');
  const robots = read('public/robots.txt');

  it('keeps a title and a description that say the game is 18+', () => {
    expect(html).toMatch(/<title>[^<]*18\+[^<]*<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]*18\+[^"]*"/);
    expect(html).toMatch(/property="og:title"/);
    expect(html).toMatch(/property="og:description"/);
    expect(html).toMatch(/name="twitter:card" content="summary_large_image"/);
    expect(html).toMatch(/name="twitter:title"/);
    expect(html).toMatch(/rel="manifest"/);
    expect(html).toMatch(/rel="icon"/);
  });

  it('rates the page adult, and still lets it be indexed', () => {
    expect(html).toMatch(/<meta name="rating" content="adult"\s*\/?>/);
    expect(html).toMatch(/<meta name="rating" content="RTA-5042-1996-1400-1577-RTA"\s*\/?>/);
    expect(html).toMatch(/<meta name="robots" content="index, follow/);
    expect(html).not.toMatch(/content="noindex/);
  });

  it('lets crawlers read the page and not the card art', () => {
    expect(robots).toMatch(/Allow:\s*\//);
    expect(robots).toMatch(/Disallow:\s*\/cards\//);
    expect(robots).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});
