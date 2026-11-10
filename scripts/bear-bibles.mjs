/**
 * Per-bear art direction for the Fooocus manifests.
 *
 * art/bear-bibles.json holds one art bible per bear card: a rendering style,
 * the visual gag on his name, fur and build, outfit and props, setting,
 * palette, lighting and camera. The only thing every bear shares is the
 * plush-toy guard in `shared`. See docs/ART_DIRECTION.md.
 *
 * Run `node scripts/bear-bibles.mjs` to write the composed prompts into
 * art/fooocus-manifest.json and art/fooocus-manifest.d/*.json in place.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BIBLES = JSON.parse(readFileSync(join(ROOT, 'art/bear-bibles.json'), 'utf8'));
export const BEAR_GUARD = BIBLES.shared;

// Morning After plates also carry an explicit refusal line its tests pin.
const TAIL = {
  ma: ' No humans, no children, no cubs.',
};

export const bibleFor = (id) => BIBLES.bears[String(id)] || null;

export const composePrompt = (id) => {
  const b = bibleFor(id);
  if (!b) return null;
  const tail = TAIL[String(id).split('-')[0]] || '';
  return `${BEAR_GUARD}. A plush teddy bear toy character: (${b.gag}:1.15). (plush teddy bear with ${b.fur_build}:1.2), ${b.outfit_props}. ${b.render}. Setting: ${b.setting}. Colour palette: ${b.palette}. Lighting: ${b.lighting}. Camera: ${b.camera}. Cheeky adult humour, no text.${tail}`;
};

// A teddy defaults to honey-brown. When the bible asks for another colour,
// push brown away so the palette survives.
const BROWNISH = /brown|tan\b|chocolate|espresso|caramel|amber|auburn|khaki|russet|beige|oxblood|honey|sand|copper|terracotta|ginger/i;

export const composeNegative = (id) => {
  const b = bibleFor(id);
  if (!b) return null;
  const parts = [BIBLES.negative];
  if (!b.painterly) parts.push(BIBLES.negative_photo_extra);
  if (!BROWNISH.test(b.fur_build)) parts.push('brown fur, tan fur, honey fur');
  return parts.join(', ');
};

// Fooocus styles for bear plates. "Fooocus Sharp" pulls every plate toward
// one cinematic grade, so bears keep only the V2 prompt expansion and let
// their bible set the look.
export const BEAR_STYLES = ['Fooocus V2'];

const apply = () => {
  let count = 0;
  const mainPath = join(ROOT, 'art/fooocus-manifest.json');
  const main = JSON.parse(readFileSync(mainPath, 'utf8'));
  main.style_prefix.bear = BEAR_GUARD;
  for (const entry of main.cards) {
    const prompt = composePrompt(entry.id);
    if (!prompt) continue;
    entry.prompt = prompt;
    entry.negative_prompt = composeNegative(entry.id);
    entry.styles = BEAR_STYLES;
    count += 1;
  }
  writeFileSync(mainPath, `${JSON.stringify(main, null, 2)}\n`);
  const dir = join(ROOT, 'art/fooocus-manifest.d');
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.json')).sort()) {
    const path = join(dir, name);
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    for (const row of rows) {
      const prompt = composePrompt(row.id);
      if (!prompt) continue;
      row.prompt = prompt;
      row.negative_prompt = composeNegative(row.id);
      row.styles = BEAR_STYLES;
      count += 1;
    }
    writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`);
  }
  const missing = Object.keys(BIBLES.bears).length - count;
  console.log(`applied ${count} bear bibles${missing ? `, ${missing} bibles had no manifest row` : ''}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) apply();
