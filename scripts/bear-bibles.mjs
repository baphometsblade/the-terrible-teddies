/**
 * Per-bear art direction for the Fooocus manifests.
 *
 * art/bear-bibles.json holds one signature per bear card: the medium, 2-3
 * named palette colours, fur, outfit, signature prop, setting, lighting,
 * camera, pose and the name gag. The only thing every bear shares is the
 * plush-toy guard in `shared`. scripts/bear-signatures.mjs checks that no two
 * signatures overlap. See docs/ART_DIRECTION.md.
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

// Fooocus-friendly order (tuned on MatrixMonster, Nov 2026). SDXL weighs the
// front of the prompt most and drops what CLIP's window cuts, so the medium
// leads at 1.35 and the name gag follows at 1.25; the plush guard comes after
// them. With the guard first (the old order) Fooocus drew a generic plush on
// every card and the medium and the joke washed out.
export const MEDIUM_WEIGHT = 1.35;
export const GAG_WEIGHT = 1.25;

// Commas inside a weighted group are fine; parentheses would close it early.
const clean = (text) => String(text || '').replace(/[()]/g, '').trim();

export const composePrompt = (id) => {
  const b = bibleFor(id);
  if (!b) return null;
  const tail = TAIL[String(id).split('-')[0]] || '';
  const medium = [b.medium, b.medium_detail].filter(Boolean).map(clean).join(', ');
  const parts = [
    `(${medium}:${MEDIUM_WEIGHT})`,
    `(${clean(b.gag)}:${GAG_WEIGHT})`,
    // The pose leads the gag in most bibles; it is only repeated when new.
    ...(clean(b.gag).includes(clean(b.pose)) ? [] : [clean(b.pose)]),
    `wearing ${clean(b.outfit)}`,
    `signature prop: ${clean(b.prop)}`,
    `setting: ${clean(b.setting)}`,
    `colour palette of ${b.palette.map(clean).join(', ')}`,
    `lighting: ${clean(b.lighting)}`,
    `camera: ${clean(b.camera)}`,
  ];
  return `${parts.join(', ')}. ${BEAR_GUARD}, fur: ${clean(b.fur)}. Cheeky adult humour, no text.${tail}`;
};

// A teddy defaults to honey-brown. When the bible asks for another colour,
// push brown away so the palette survives.
const BROWNISH = /brown|tan\b|chocolate|espresso|caramel|amber|auburn|khaki|russet|beige|oxblood|honey|sand|copper|terracotta|ginger/i;

// SDXL letters anything that looks like a poster or a cover, and draws a
// person when a costume is described. Both are pushed down hard.
const NO_TEXT = '(text, lettering, letters, words, typography, title, caption:1.3)';
const NO_PEOPLE = '(human, man, woman, person, human face, human hands:1.3)';
const PAINTERLY_NEG = 'photo, photograph, photorealistic, depth of field, bokeh';

export const composeNegative = (id) => {
  const b = bibleFor(id);
  if (!b) return null;
  // A bear's own negative goes first and carries its own weight: what that
  // medium or scene tends to turn into (a pin-up for a jazz sleeve, a cat for
  // origami, a car for a lowrider mural).
  const parts = [...(b.negative_extra ? [b.negative_extra] : []), NO_TEXT, NO_PEOPLE, BIBLES.negative];
  parts.push(b.painterly ? PAINTERLY_NEG : BIBLES.negative_photo_extra);
  if (!BROWNISH.test(b.fur)) parts.push('brown fur, tan fur, honey fur');
  return parts.join(', ');
};

// Fooocus styles for bear plates. A bear's signature may name Fooocus style
// presets that match its medium (Papercraft, Embroidery, Origami...). With
// none named it gets no preset at all: "Fooocus V2" rewrites the prompt with
// generic words and "Fooocus Sharp" pulls every plate toward one grade.
export const stylesFor = (id) => {
  const b = bibleFor(id);
  return b && Array.isArray(b.styles) ? b.styles : [];
};

// Sampler settings the tuning settled on: the Quality preset (60 steps) and a
// guidance a notch above Fooocus's default so the medium and gag hold.
export const BEAR_RENDER = { performance: 'Quality', guidance_scale: 6 };

const apply = () => {
  let count = 0;
  const mainPath = join(ROOT, 'art/fooocus-manifest.json');
  const main = JSON.parse(readFileSync(mainPath, 'utf8'));
  main.style_prefix.bear = BEAR_GUARD;
  for (const entry of main.cards) {
    const prompt = composePrompt(entry.id);
    if (!prompt) continue;
    Object.assign(entry, { prompt, negative_prompt: composeNegative(entry.id), styles: stylesFor(entry.id), ...BEAR_RENDER });
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
      Object.assign(row, { prompt, negative_prompt: composeNegative(row.id), styles: stylesFor(row.id), ...BEAR_RENDER });
      count += 1;
    }
    writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`);
  }
  const missing = Object.keys(BIBLES.bears).length - count;
  console.log(`applied ${count} bear bibles${missing ? `, ${missing} bibles had no manifest row` : ''}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) apply();
