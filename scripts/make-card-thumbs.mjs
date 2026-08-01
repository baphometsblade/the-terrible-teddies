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
 * Usage:
 *   npm run art:thumbs            # generate missing/stale thumbs
 *   npm run art:thumbs -- --force  # regenerate every thumb
 *
 * A thumb is skipped (left alone) when it already exists and its mtime is
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
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(__dirname, '..', 'public', 'cards');
const THUMBS_DIR = path.join(CARDS_DIR, 'thumbs');

const THUMB_WIDTH = 192;
const THUMB_HEIGHT = 256;
const THUMB_QUALITY = 78;

const force = process.argv.includes('--force');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  fs.mkdirSync(THUMBS_DIR, { recursive: true });

  const sourceFiles = fs
    .readdirSync(CARDS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.webp'))
    .map((entry) => entry.name)
    .sort();

  let written = 0;
  let skipped = 0;
  let sourceBytes = 0;
  let thumbBytes = 0;

  for (const fileName of sourceFiles) {
    const srcPath = path.join(CARDS_DIR, fileName);
    const thumbPath = path.join(THUMBS_DIR, fileName);

    const srcStat = fs.statSync(srcPath);
    sourceBytes += srcStat.size;

    if (!force && fs.existsSync(thumbPath)) {
      const thumbStat = fs.statSync(thumbPath);
      if (thumbStat.mtimeMs >= srcStat.mtimeMs) {
        skipped += 1;
        thumbBytes += thumbStat.size;
        continue;
      }
    }

    const buf = fs.readFileSync(srcPath);
    const out = await sharp(buf)
      .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover', position: 'attention' })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();

    fs.writeFileSync(thumbPath, out);
    written += 1;
    thumbBytes += out.length;
  }

  console.log(`Card thumbnails: ${written} written, ${skipped} skipped (up to date).`);
  console.log(`Source total:  ${formatBytes(sourceBytes)} (${sourceFiles.length} files)`);
  console.log(`Thumb total:   ${formatBytes(thumbBytes)} (${written + skipped} files)`);
  if (sourceBytes > 0) {
    const pct = ((thumbBytes / sourceBytes) * 100).toFixed(1);
    console.log(`Thumbs are ${pct}% of source size.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
