/**
 * For scripts/check-art-variants.py: writes, for each card master, a
 * lossless reference at every variant size (the master resized exactly as
 * the variants are) and each shipped variant decoded to PNG, so the gate can
 * score them without an AVIF decoder of its own.
 *
 *   node scripts/lib/dump-art-variants.mjs <out-dir> [id,id,...]
 * Prints a JSON list of { id, variant, ref, file, bytes }.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { VARIANTS, isMasterName, variantPath } from './card-art-variants.mjs';

const CARDS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'cards');
const [out, only] = process.argv.slice(2);
if (!out) {
  console.error('usage: dump-art-variants.mjs <out-dir> [ids]');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
const ids = fs.readdirSync(CARDS).filter(isMasterName).map((f) => f.slice(0, -5))
  .filter((id) => !only || only.split(',').includes(id)).sort();
const rows = [];
for (const id of ids) {
  const master = fs.readFileSync(path.join(CARDS, `${id}.webp`));
  const refs = {};
  for (const v of VARIANTS) {
    const key = `${v.width}x${v.height}`;
    if (!refs[key]) {
      refs[key] = path.join(out, `${id}-${key}-ref.png`);
      await sharp(master).resize(v.width, v.height, { fit: 'cover', position: 'attention', kernel: 'lanczos3' }).png().toFile(refs[key]);
    }
    const file = variantPath(CARDS, id, v);
    if (!fs.existsSync(file)) { rows.push({ id, variant: v.name, ref: refs[key], file: null, bytes: 0 }); continue; }
    const decoded = path.join(out, `${id}-${v.name}.png`);
    await sharp(file).png().toFile(decoded);
    rows.push({ id, variant: v.name, ref: refs[key], file: decoded, bytes: fs.statSync(file).size });
  }
}
process.stdout.write(JSON.stringify(rows));
