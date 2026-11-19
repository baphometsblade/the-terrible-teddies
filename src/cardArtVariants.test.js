// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { VARIANTS, MASTER, isMasterName, variantPath, encodeVariant, nearLosslessPng, QUALITY_OVERRIDES } from '../scripts/lib/card-art-variants.mjs';

// Every card picture is served from one master, public/cards/<id>.webp, and
// the sizes and formats scripts/lib/card-art-variants.mjs makes from it. The
// app asks for those by name (ArtOrEmoji, the preloads), so a master without
// them, or with ones left over from an older picture, is a card that shows
// the wrong art or downloads the 768px plate where a 192px one would do.
const CARDS = path.resolve(process.cwd(), 'public/cards');
const masters = fs.readdirSync(CARDS).filter(isMasterName).map((f) => f.slice(0, -5)).sort();

// A 12x16 grey sketch of a picture. Over the shipped set a variant was never
// further than 9 (of 255, mean per pixel) from its own master, and no two
// different cards closer than 15, so 12 tells "the same picture, resized and
// re-encoded" from "another picture".
const sketch = async (file) => sharp(file).resize(12, 16, { fit: 'fill' }).greyscale().raw().toBuffer();
const distance = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
const SAME_PICTURE = 12;

describe('card art variants', () => {
  it('has a master for every card', () => {
    expect(masters.length).toBeGreaterThanOrEqual(127);
  });

  it('ships every size and format for every master, at the size and in the format it claims', async () => {
    const problems = [];
    for (const id of masters) {
      const m = await sharp(path.join(CARDS, `${id}.webp`)).metadata();
      if (m.width !== MASTER.width || m.height !== MASTER.height) problems.push(`${id}.webp is ${m.width}x${m.height}`);
      for (const v of VARIANTS) {
        const file = variantPath(CARDS, id, v);
        if (!fs.existsSync(file)) { problems.push(`missing ${path.relative(CARDS, file)}`); continue; }
        const meta = await sharp(file).metadata();
        const format = meta.format === 'heif' ? 'avif' : meta.format;
        if (format !== v.format || meta.width !== v.width || meta.height !== v.height) {
          problems.push(`${path.relative(CARDS, file)} is ${format} ${meta.width}x${meta.height}`);
        }
      }
    }
    expect(problems, 'run npm run art:thumbs').toEqual([]);
  }, 60_000);

  it('makes each variant from the current master, not an older picture', async () => {
    const stale = [];
    for (const id of masters) {
      const master = await sketch(path.join(CARDS, `${id}.webp`));
      for (const v of VARIANTS) {
        const d = distance(master, await sketch(variantPath(CARDS, id, v)));
        if (d > SAME_PICTURE) stale.push(`${v.dir}/${id}.${v.ext} (${d.toFixed(1)})`);
      }
    }
    expect(stale, 'run npm run art:thumbs -- --force --only <ids>').toEqual([]);
  }, 60_000);

  it('leaves no variant without a master', () => {
    const orphans = [];
    for (const dir of new Set(VARIANTS.map((v) => v.dir))) {
      for (const f of fs.readdirSync(path.join(CARDS, dir))) {
        const stem = f.replace(/\.(webp|avif)$/, '');
        if (!masters.includes(stem)) orphans.push(`${dir}/${f}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('keeps the AVIF thumbs smaller than the WebP ones they stand in for', () => {
    const size = (v) => masters.reduce((sum, id) => sum + fs.statSync(variantPath(CARDS, id, VARIANTS.find((x) => x.name === v))).size, 0);
    expect(size('thumb-avif')).toBeLessThan(size('thumb-webp') * 0.85);
    expect(size('mid-avif')).toBeLessThan(size('mid-webp'));
  });

  it('only overrides the quality of cards that exist, within range', () => {
    for (const [variant, byId] of Object.entries(QUALITY_OVERRIDES)) {
      expect(VARIANTS.some((v) => v.name === variant), variant).toBe(true);
      for (const [id, q] of Object.entries(byId)) {
        expect(masters, `${variant} override for ${id}`).toContain(id);
        expect(q).toBeGreaterThan(0);
        expect(q).toBeLessThanOrEqual(100);
      }
    }
  });

  it('encodes a master into each variant at its size', async () => {
    const master = await sharp({ create: { width: 768, height: 1024, channels: 3, background: '#a05030' } }).webp().toBuffer();
    for (const v of VARIANTS) {
      const meta = await sharp(await encodeVariant(master, v, 'x')).metadata();
      expect([meta.format === 'heif' ? 'avif' : meta.format, meta.width, meta.height], v.name).toEqual([v.format, v.width, v.height]);
    }
  });
});

describe('near-lossless PNG', () => {
  // Like a photo: smooth light with grain over it (the icons are renders).
  const photo = (width, height, channels) => {
    const data = Buffer.alloc(width * height * channels);
    let seed = 7;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        for (let c = 0; c < channels; c += 1) {
          seed = (seed * 1103515245 + 12345) >>> 0;
          const grain = (seed >>> 28) - 8;
          const i = (y * width + x) * channels + c;
          data[i] = c === 3 ? (x * 4) & 255 : Math.max(0, Math.min(255, 40 + x * 2 + y + c * 30 + grain));
        }
      }
    }
    return { data, info: { width, height, channels } };
  };

  it('moves no colour channel by more than one level, keeps alpha exact, and comes out smaller', async () => {
    for (const channels of [3, 4]) {
      const { data, info } = photo(64, 48, channels);
      const png = await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
      const out = await nearLosslessPng(png);
      const back = await sharp(out).raw().toBuffer({ resolveWithObject: true });
      expect([back.info.width, back.info.height, back.info.channels]).toEqual([64, 48, channels]);
      let worst = 0;
      let drift = 0;
      for (let i = 0; i < data.length; i += 1) {
        const alpha = channels === 4 && i % 4 === 3;
        const d = back.data[i] - data[i];
        if (alpha) expect(d).toBe(0);
        else { worst = Math.max(worst, Math.abs(d)); drift += d; }
      }
      expect(worst).toBeLessThanOrEqual(1);
      // Ties go to even, so the picture does not get darker or lighter.
      expect(Math.abs(drift / data.length)).toBeLessThan(0.05);
      expect(out.length).toBeLessThan(png.length);
    }
  });
});

describe('the app icons', () => {
  // They were 624 KB and 410 KB as plain PNGs; near-lossless they are under
  // half that. A budget, so a regenerated icon cannot quietly undo it.
  const budget = { 'icon-512.png': 340_000, 'icon-maskable-512.png': 240_000, 'icon-192.png': 64_000, 'icon-maskable-192.png': 48_000, 'apple-touch-icon.png': 56_000 };
  it.each(Object.entries(budget))('%s stays within its byte budget', (file, max) => {
    expect(fs.statSync(path.resolve(process.cwd(), 'public', file)).size).toBeLessThan(max);
  });
});
