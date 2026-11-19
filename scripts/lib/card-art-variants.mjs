/**
 * The files the app serves for each card picture, made from the one master
 * every art pipeline writes: public/cards/<id>.webp (768x1024).
 *
 *   thumbs/<id>.webp  192x256  small UI (collection grid, battle hand, pack faces)
 *   thumbs/<id>.avif  192x256  the same, as AVIF, for the browsers that take it
 *   mid/<id>.webp     480x640  art drawn about 150 CSS px wide on a 2-3x screen
 *   mid/<id>.avif     480x640  (menu fan, zoomed grids, the battle's big card)
 *
 * The master itself stays WebP only. Re-encoded to AVIF at the fidelity the
 * WebP already has, it came out the same size (95 KB vs 97 KB at SSIMULACRA2
 * 80 over a 21-card sample), so there is nothing to win there.
 *
 * Qualities were chosen by measurement, not taste, against a lossless
 * resize of the master (scripts/check-art-variants.py, docs in
 * public/cards/README.md):
 *   - an AVIF thumb is at least as faithful as the WebP thumb it replaces,
 *     or scores SSIMULACRA2 >= 80 ("very high quality") where that WebP was
 *     better than that;
 *   - a mid file scores SSIMULACRA2 >= 80, in both formats.
 * QUALITY_OVERRIDES holds the pictures that needed more than the default to
 * pass. The gate prints any new ones.
 *
 * Every pipeline that writes a master calls writeCardVariants for it
 * (npm run art:thumbs, scripts/generate-card-art.mjs, and the Fooocus
 * generate/inpaint scripts' finishing step), so new art gets all four.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';

export const MASTER = { width: 768, height: 1024 };

export const VARIANTS = [
  { name: 'thumb-webp', dir: 'thumbs', ext: 'webp', width: 192, height: 256, format: 'webp', quality: 78 },
  { name: 'thumb-avif', dir: 'thumbs', ext: 'avif', width: 192, height: 256, format: 'avif', quality: 60 },
  { name: 'mid-webp', dir: 'mid', ext: 'webp', width: 480, height: 640, format: 'webp', quality: 90 },
  { name: 'mid-avif', dir: 'mid', ext: 'avif', width: 480, height: 640, format: 'avif', quality: 70 },
];

// Per-picture qualities the gate asked for, by variant then card id.
export const QUALITY_OVERRIDES = {
  'thumb-avif': {},
  'thumb-webp': {},
  'mid-webp': {},
  'mid-avif': {},
};

export const qualityFor = (variant, stem) => QUALITY_OVERRIDES[variant.name]?.[stem] ?? variant.quality;

/** A master is a file directly in public/cards named <id>.webp. */
export const isMasterName = (name) => /^[A-Za-z0-9-]+\.webp$/.test(name);

export const variantPath = (cardsDir, stem, variant) => path.join(cardsDir, variant.dir, `${stem}.${variant.ext}`);

/** Encodes one variant of a master (a Buffer or a path) into a Buffer. */
export const encodeVariant = async (master, variant, stem = '') => {
  const quality = qualityFor(variant, stem);
  // Same 3:4 shape as the master, so "attention" never crops; it is kept so
  // a master of another shape still fills the slot the way the thumbs did.
  const resized = sharp(master).resize(variant.width, variant.height, { fit: 'cover', position: 'attention', kernel: 'lanczos3' });
  if (variant.format === 'avif') return resized.avif({ quality, effort: 6, chromaSubsampling: '4:2:0' }).toBuffer();
  return resized.webp({ quality, effort: variant.name === 'thumb-webp' ? 4 : 6 }).toBuffer();
};

/**
 * Writes every variant for one master. A variant newer than its master is
 * left alone unless `force`. Returns [{ variant, path, bytes, written }].
 */
export const writeCardVariants = async (masterPath, { force = false, only = null } = {}) => {
  const cardsDir = path.dirname(masterPath);
  const stem = path.basename(masterPath, '.webp');
  const srcStat = fs.statSync(masterPath);
  const master = fs.readFileSync(masterPath);
  const rows = [];
  for (const variant of VARIANTS) {
    if (only && !only.includes(variant.name)) continue;
    const out = variantPath(cardsDir, stem, variant);
    if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= srcStat.mtimeMs) {
      rows.push({ variant: variant.name, path: out, bytes: fs.statSync(out).size, written: false });
      continue;
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const buf = await encodeVariant(master, variant, stem);
    fs.writeFileSync(out, buf);
    rows.push({ variant: variant.name, path: out, bytes: buf.length, written: true });
  }
  return rows;
};

/**
 * A PNG within one level per colour channel of its source, losslessly
 * packed. Rounding each channel to an even value (ties to even, so the
 * picture does not drift darker) halves the values zlib has to tell apart;
 * on the photographic app icons that took 609 KB to 289 KB at SSIMULACRA2
 * 94.7, where 90 is the usual bar for visually lossless. Alpha is kept
 * exact. Palette quantisation was tried and rejected: 256 colours scored 74
 * on the same icon (visible banding in the neon and the fur). oxipng then
 * repacks the PNG losslessly (another ~7% over zlib at level 9).
 */
export const nearLosslessPng = async (input) => {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const colour = info.channels === 4 || info.channels === 2 ? info.channels - 1 : info.channels;
  for (let i = 0; i < data.length; i += info.channels) {
    for (let c = 0; c < colour; c += 1) {
      const v = data[i + c];
      if (v & 1) data[i + c] = Math.min(255, (v >> 1) & 1 ? v + 1 : v - 1);
    }
  }
  const packed = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
  const repacked = await oxipng(packed);
  return repacked.length < packed.length ? repacked : packed;
};

// oxipng (WebAssembly), loaded once. Lossless, so the pixels are the ones
// sharp wrote.
let oxipngReady = null;
const oxipng = async (png) => {
  if (!oxipngReady) {
    oxipngReady = (async () => {
      const require = createRequire(import.meta.url);
      const pkgDir = path.dirname(require.resolve('@jsquash/oxipng/package.json'));
      const { default: optimise, init } = await import('@jsquash/oxipng/optimise.js');
      await init(await WebAssembly.compile(fs.readFileSync(path.join(pkgDir, 'codec/pkg/squoosh_oxipng_bg.wasm'))));
      return optimise;
    })();
  }
  const optimise = await oxipngReady;
  const out = await optimise(png.buffer.slice(png.byteOffset, png.byteOffset + png.length), { level: 6, interlace: false, optimiseAlpha: false });
  return Buffer.from(out);
};
