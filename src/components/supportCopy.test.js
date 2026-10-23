import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

// The purchase screen told buyers to "contact support" while no address,
// link or form existed anywhere in the app. Copy that sends a player to
// support, or to terms, must come with the way there: a file that says it
// also uses the configured contact (src/lib/support.js).

const SRC = resolve(process.cwd(), 'src');
const sources = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return sources(path);
  return /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
});

// Comments may name the old copy (they say why it went); only code counts.
const code = (path) => readFileSync(path, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('copy that points somewhere has somewhere to point', () => {
  it('never says "contact support" without the support contact', () => {
    const dangling = sources(SRC)
      .filter((path) => !path.endsWith(join('lib', 'support.js')))
      .filter((path) => /contact (our )?support|email support|terms of service/i.test(code(path)))
      .filter((path) => !/from '@\/lib\/support'/.test(code(path)));
    expect(dangling.map((p) => p.slice(SRC.length + 1))).toEqual([]);
  });
});
