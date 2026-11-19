/**
 * Card-art thumbnail generator.
 *
 * Why this exists (measured, not guessed): card art ships at 768x1024
 * everywhere, but the art window it's actually rendered into is tiny —
 * ~84x52 CSS px in the battle hand and the collection grid. The collection
 * view renders all 64 catalog cards at once. Full-res files average ~100 KB;
 * a 192x256 thumbnail (same 3:4 ratio) of the same image is ~11 KB. Viewing
 * the whole collection today costs ~6.4 MB where ~0.7 MB would do — about
 * 9x more bytes than can ever be displayed at that size, and it hits mobile
 * hardest since the images are merely lazy-loaded, not right-sized.
 *
 * This script reads every public/cards/<id>.webp and writes a matching
 * public/cards/thumbs/<id>.webp at 192x256, so small UI (collection grid,
 * battle hand) can request the small file directly instead of downscaling
 * the full-res image in the browser. `ArtOrEmoji` in TeddyCard.jsx picks
 * these up via its `variant` prop ('thumb' by default, 'full' for the
 * handful of places art is shown large, like the collection detail modal).
 *
 * It now writes every served size and format, not just the WebP thumb:
 * thumbs/<id>.{webp,avif} at 192x256 and mid/<id>.{webp,avif} at 480x640.
 * What each is for, and how their qualities were chosen, is in
 * scripts/lib/card-art-variants.mjs.
 *
 * Usage:
 *   npm run art:thumbs                     # generate missing/stale files
 *   npm run art:thumbs -- --force          # regenerate every file
 *   npm run art:thumbs -- --only 51,ma-3   # just these cards (with --force to redo)
 *   npm run art:thumbs -- --variant thumb-avif,mid-avif
 *
 * A file is skipped (left alone) when it already exists and its mtime is
 * newer than its source's — i.e. it's already up to date. --force ignores
 * that check and regenerates everything.
 *
 * IMPORTANT: re-run this (or run it with --force for the changed ids)
 * whenever card art changes, or the thumb will silently keep serving the
 * old image. See public/cards/README.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { VARIANTS, isMasterName, writeCardVariants } from './lib/card-art-variants.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'public', 'cards');

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const listArg = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
};
const onlyIds = listArg('--only');
const onlyVariants = listArg('--variant');
if (onlyVariants) {
  const unknown = onlyVariants.filter((v) => !VARIANTS.some((x) => x.name === v));
  if (unknown.length) {
    console.error(`unknown --variant ${unknown.join(', ')} (have ${VARIANTS.map((v) => v.name).join(', ')})`);
    process.exit(2);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const masters = fs
    .readdirSync(CARDS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isMasterName(entry.name))
    .map((entry) => entry.name)
    .filter((name) => !onlyIds || onlyIds.includes(path.basename(name, '.webp')))
    .sort();
  if (onlyIds) {
    const missing = onlyIds.filter((id) => !masters.includes(`${id}.webp`));
    if (missing.length) {
      console.error(`no master public/cards/<id>.webp for: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  const totals = Object.fromEntries(VARIANTS.map((v) => [v.name, { written: 0, skipped: 0, bytes: 0 }]));
  let sourceBytes = 0;
  // AVIF at effort 6 is slow (seconds per 480px file); spread it over the cores.
  const queue = [...masters];
  const worker = async () => {
    while (queue.length) {
      const name = queue.shift();
      const src = path.join(CARDS_DIR, name);
      sourceBytes += fs.statSync(src).size;
      for (const row of await writeCardVariants(src, { force, only: onlyVariants })) {
        const t = totals[row.variant];
        t.bytes += row.bytes;
        if (row.written) t.written += 1;
        else t.skipped += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, os.cpus().length)) }, worker));

  console.log(`Card art variants for ${masters.length} masters (${formatBytes(sourceBytes)}):`);
  for (const [name, t] of Object.entries(totals)) {
    if (onlyVariants && !onlyVariants.includes(name)) continue;
    console.log(`  ${name.padEnd(11)} ${String(t.written).padStart(3)} written, ${String(t.skipped).padStart(3)} up to date, ${formatBytes(t.bytes)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
