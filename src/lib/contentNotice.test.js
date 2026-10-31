import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CONTENT_NOTICE } from './contentNotice';

// Claims against reality: the content descriptor lives in ONE module. A screen
// that spells out its own copy of it will drift the next time the rating
// changes, so the phrase may appear in no other source file.
const SRC = join(process.cwd(), 'src');
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const sources = walk(SRC).filter((p) => /\.(jsx?|mjs)$/.test(p));
const rel = (p) => relative(process.cwd(), p).replaceAll('\\', '/');

describe('the content notice', () => {
  it('is a fragment that reads after "contains"', () => {
    expect(CONTENT_NOTICE).toMatch(/^[a-z]/);
    expect(CONTENT_NOTICE).not.toMatch(/[.!]$/);
  });

  it('is imported by the sign-in screen and the tutorial', () => {
    for (const file of ['src/components/Auth.jsx', 'src/components/Tutorial.jsx']) {
      expect(readFileSync(join(process.cwd(), file), 'utf8'), file).toMatch(/lib\/contentNotice/);
    }
  });

  it('is spelled out in no other source file', () => {
    const offenders = sources
      .filter((p) => !/contentNotice\.(test\.)?js$/.test(p))
      .filter((p) => /substance-abuse/i.test(readFileSync(p, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
