import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ALL_CARDS } from '@/stores/gameStore';
import { OPPONENT_GOONS } from '@/utils/opponentDeck';
import { BOSS_CARD } from '@/lib/houseRules';
import { cardArtId, fullArtUrl, thumbUrl } from './preloadArt';

// Every card the game can put on screen, including modules that export a
// *Cards array (the lo- / hd- / ma- sets land that way) and the goons and
// the boss, which are not in ALL_CARDS. A new id with no file and no
// manifest row fails here.
const modules = import.meta.glob('../data/**/*Cards.js', { eager: true });

const fromModules = Object.values(modules).flatMap((mod) =>
  Object.values(mod).filter((value) => Array.isArray(value) && value.some((card) => card && card.id != null && card.name))
).flat();

const registered = (() => {
  const byId = new Map();
  for (const card of [...ALL_CARDS, ...fromModules, ...OPPONENT_GOONS, BOSS_CARD]) {
    byId.set(String(card.id), card);
  }
  return [...byId.values()];
})();

const root = process.cwd();
const readManifest = (file) => {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(data) ? data : data.cards;
};

const manifestFiles = () => {
  const main = resolve(root, 'art/fooocus-manifest.json');
  const dir = resolve(root, 'art/fooocus-manifest.d');
  const extra = existsSync(dir)
    ? readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => join(dir, name))
    : [];
  return [main, ...extra];
};

const mainDoc = JSON.parse(readFileSync(resolve(root, 'art/fooocus-manifest.json'), 'utf8'));
const manifest = manifestFiles().flatMap(readManifest).map((entry) => ({
  ...entry,
  path: entry.path || entry.target,
  aspect_ratio: entry.aspect_ratio || entry.aspect,
  negative_prompt: entry.negative_prompt || mainDoc.negative_prompt,
}));
const byId = new Map(manifest.map((entry) => [String(entry.id), entry]));

const BANNED = /\b(child|children|kid|kids|cubs?|minor|minors|school|teen|teens|underage|loli|shota|toddler|infant|preteen|jailbait)\b/i;
// "no children" is a refusal, not a request. Strip those before the check.
const NEGATED = /\bno\s+(?:child(?:ren)?|kids?|cubs?|minors?|teens?)\b/gi;
const ASPECT = /^\d+\*\d+$/;

const isWebp = (file) => {
  const buf = readFileSync(file);
  return buf.length > 100 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
};

describe('every registered card resolves to same-origin art', () => {
  it('finds the catalog, the goons and the boss', () => {
    expect(registered.length).toBeGreaterThan(80);
    expect(registered.some((card) => card.id === 109)).toBe(true);
    expect(registered.some((card) => card.id === 101)).toBe(true);
  });

  it.each(registered.map((card) => [String(card.id), card]))('%s has a safe same-origin path', (id) => {
    expect(cardArtId(id)).toBe(id);
    expect(thumbUrl(id)).toBe(`/cards/thumbs/${id}.webp`);
    expect(fullArtUrl(id)).toBe(`/cards/${id}.webp`);
    expect(thumbUrl(id).startsWith('/cards/')).toBe(true);
    expect(fullArtUrl(id).includes('..')).toBe(false);
  });
});

describe('the Fooocus manifest covers the raster set', () => {
  it('lists every registered card, once', () => {
    const missing = registered.filter((card) => !byId.has(String(card.id))).map((card) => card.id);
    expect(missing, `add these ids to art/fooocus-manifest.json or art/fooocus-manifest.d\n${missing.join(', ')}`).toEqual([]);
  });

  it('gives every entry a path, an aspect and a prompt', () => {
    expect(manifest.length).toBeGreaterThan(registered.length);
    for (const entry of manifest) {
      expect(entry.id, 'id').toBeTruthy();
      expect(entry.type, entry.id).toBeTruthy();
      expect(entry.path, entry.id).toMatch(/^public\/.+\.(webp|png|jpe?g|ico)$/);
      expect(entry.path.includes('..'), entry.id).toBe(false);
      expect(entry.aspect_ratio, entry.id).toMatch(ASPECT);
      expect(entry.prompt.length, entry.id).toBeGreaterThan(40);
      expect(entry.negative_prompt.length, entry.id).toBeGreaterThan(20);
      expect(entry.prompt.replace(NEGATED, ''), entry.id).not.toMatch(BANNED);
      expect(entry.prompt, entry.id).not.toMatch(/https?:\/\//);
    }
  });

  it('asks for adult bears on character cards', () => {
    for (const entry of manifest.filter((row) => row.type === 'card' && row.prefix === 'bear')) {
      expect(entry.prompt.toLowerCase(), entry.id).toContain('adult');
      expect(entry.aspect_ratio, entry.id).toBe('896*1152');
      expect(entry.path, entry.id).toBe(`public/cards/${entry.id}.webp`);
      expect(entry.outputs.some((out) => out.path === `public/cards/thumbs/${entry.id}.webp` && out.width === 192 && out.height === 256)).toBe(true);
    }
  });

  it('reads extra manifests from art/fooocus-manifest.d', () => {
    const dir = resolve(root, 'art/fooocus-manifest.d');
    expect(existsSync(dir)).toBe(true);
    for (const file of manifestFiles().slice(1)) {
      expect(readManifest(file).length).toBeGreaterThan(0);
    }
  });
});

describe('shipped card files are real webp, including in the build output', () => {
  const dist = resolve(root, 'dist/cards');
  const built = existsSync(dist);

  it('checks the files that are already on disk', () => {
    for (const card of registered) {
      const id = String(card.id);
      const full = resolve(root, 'public/cards', `${id}.webp`);
      const thumb = resolve(root, 'public/cards/thumbs', `${id}.webp`);
      if (!existsSync(full)) {
        expect(byId.has(id), `${id} is missing and not in the Fooocus manifest`).toBe(true);
        continue;
      }
      expect(isWebp(full), id).toBe(true);
      expect(existsSync(thumb), `${id} thumb`).toBe(true);
      expect(isWebp(thumb), `${id} thumb`).toBe(true);
      if (built) {
        expect(statSync(resolve(dist, `${id}.webp`)).size, `${id} in dist`).toBeGreaterThan(100);
        expect(statSync(resolve(dist, 'thumbs', `${id}.webp`)).size, `${id} thumb in dist`).toBeGreaterThan(100);
      }
    }
  });
});

describe('the Fooocus script', () => {
  const source = readFileSync(resolve(root, 'scripts/generate-card-art-fooocus.py'), 'utf8');

  it('calls Fooocus-API and resizes with sharp, and does not pull another image library', () => {
    expect(source).toContain("import requests");
    expect(source).toContain('/v1/generation/text-to-image');
    expect(source).toContain('http://127.0.0.1:8888');
    expect(source).toContain("require('sharp')");
    expect(source).not.toContain('pillow');
    expect(source).not.toContain('from PIL');
    expect(source).toContain('fooocus-manifest.d');
    expect(source).toContain('manifest-dir');
  });
});
