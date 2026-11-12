/**
 * Bear signature uniqueness checker.
 *
 * Mark's brief (Nov 2026): every bear must be told apart by eye, and every
 * bear's prompt must identify that bear and no other. Each bear in
 * art/bear-bibles.json carries an explicit signature (medium, palette, fur,
 * outfit, signature prop, setting, lighting, camera, pose and the name gag).
 * This module checks the set as a whole:
 *
 *   1. every signature field is filled in, with 2-3 named palette colours;
 *   2. no two bears share a medium + palette;
 *   3. no two bears share a setting + signature prop;
 *   4. no two bears share an identical signature tuple;
 *   5. no two bears share a medium, and no two of the same kind of picture
 *      (photo, print, painting, drawing, craft) share a palette, compared by
 *      hue ("Chuck's teal" and "thread teal" are both teal);
 *   6. every name gag says the bear's name;
 *   7. no two composed prompts are too alike in their words (TF-IDF cosine,
 *      with the shared plush guard and fixed character looks taken out).
 *
 * Pure functions, no I/O beyond what the caller passes in, so the unit test
 * (src/artSignatures.test.js) and the CLI share one implementation:
 *
 *     node scripts/bear-signatures.mjs          # report, exit 1 on any failure
 *     node scripts/bear-signatures.mjs --top 15 # also list the closest prompt pairs
 */
export const SIGNATURE_FIELDS = [
  'name', 'name_gag', 'medium', 'medium_detail', 'palette', 'fur', 'outfit', 'prop',
  'setting', 'lighting', 'camera', 'pose', 'gag',
];

// Above this TF-IDF cosine two prompts read as variations of one picture.
// The set sits well under it (see the CLI report); a rewrite that drifts
// toward another bear trips it long before the pictures could be confused.
export const PROMPT_SIMILARITY_LIMIT = 0.22;

// Characters whose look is fixed by the game (Chuck keeps his bow tie and gold
// tooth on every card). Their shared description is not a lookalike.
export const FIXED_LOOKS = {
  chuck: 'honey-brown adult plush bartender teddy with a barrel chest, greying muzzle, half-lidded glass eyes, loosened black bow tie, teal short-sleeve shirt unbuttoned, and one gold tooth',
};

const norm = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// A colour name keeps its hue words only: "Chuck's teal" and "thread teal"
// are both teal, "ink black" and "toner black" are both black.
const HUES = ['red', 'orange', 'yellow', 'gold', 'green', 'teal', 'turquoise', 'cyan', 'blue', 'navy', 'indigo',
  'violet', 'purple', 'plum', 'lilac', 'lavender', 'magenta', 'pink', 'rose', 'peach', 'coral', 'cream', 'white',
  'ivory', 'black', 'grey', 'gray', 'silver', 'brown', 'umber', 'sepia', 'ochre', 'amber', 'tan', 'beige', 'copper',
  'brass', 'crimson', 'scarlet', 'burgundy', 'oxblood', 'terracotta', 'mint', 'lime', 'olive', 'chrome', 'platinum'];

export const colourKey = (colour) => {
  const words = norm(colour).split(' ');
  const hue = words.filter((word) => HUES.includes(word));
  return hue.length ? hue.join(' ') : norm(colour);
};

// The broad kind of picture a medium makes. Two bears of one kind in one
// palette read as the same card at thumbnail size, whatever the medium says.
const FAMILIES = [
  ['craft', /embroider|stitch|papercut|paper cut|origami|quilling|tapestry|mosaic|stained-glass|stained glass|scrimshaw|chalk|sampler|tile|patch|diorama|stop-motion|clay|felt/],
  ['painting', /painting|oil|watercolour|watercolor|pastel|mural|gouache|airbrush|fresco|portrait/],
  ['photo', /photo|still|snapshot|polaroid|tintype|camera|selfie|freeze-frame|vhs|screenshot|split-screen|film|shot/],
  ['print', /print|engraving|woodcut|woodblock|lithograph|linocut|mezzotint|screenprint|silkscreen|xerox|poster|flash sheet|label|card|plate/],
  ['drawing', /drawing|sketch|cartoon|comic|anime|illustration|blueprint|manuscript|icon|ink|art|render|glitch/],
];

export const mediumFamily = (medium) => {
  const text = String(medium || '').toLowerCase();
  const hit = FAMILIES.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : 'other';
};

const STOP = new Set(('a an the and or of in on at to with by for from his her their its is as like into over under '
  + 'one two very no not only just while who that this it up out off down back all each every there plush teddy bear '
  + 'bears toy stuffed adult paw paws fur colour palette').split(' '));

const tokens = (text) => norm(text).split(' ').filter((word) => word.length > 2 && !STOP.has(word));

/** The words a bear's prompt is compared on: its signature, minus any fixed character look. */
export const signatureText = (bear) => {
  let text = SIGNATURE_FIELDS.filter((field) => field !== 'name' && field !== 'name_gag')
    .map((field) => (Array.isArray(bear[field]) ? bear[field].join(' ') : bear[field]))
    .join(' ');
  const look = bear.character && FIXED_LOOKS[bear.character];
  if (look) text = text.split(look).join(' ');
  return text;
};

/** Pairwise TF-IDF cosine over every bear's signature text. */
export const promptSimilarity = (bears) => {
  const ids = Object.keys(bears);
  const docs = ids.map((id) => tokens(signatureText(bears[id])));
  const df = new Map();
  for (const doc of docs) for (const word of new Set(doc)) df.set(word, (df.get(word) || 0) + 1);
  const n = docs.length;
  const vectors = docs.map((doc) => {
    const tf = new Map();
    for (const word of doc) tf.set(word, (tf.get(word) || 0) + 1);
    const vec = new Map();
    let sq = 0;
    for (const [word, count] of tf) {
      const weight = (1 + Math.log(count)) * Math.log((1 + n) / (1 + df.get(word)) + 1);
      vec.set(word, weight);
      sq += weight * weight;
    }
    const len = Math.sqrt(sq) || 1;
    for (const [word, weight] of vec) vec.set(word, weight / len);
    return vec;
  });
  const pairs = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      let dot = 0;
      const [small, big] = vectors[i].size < vectors[j].size ? [vectors[i], vectors[j]] : [vectors[j], vectors[i]];
      for (const [word, weight] of small) if (big.has(word)) dot += weight * big.get(word);
      pairs.push({ a: ids[i], b: ids[j], score: Math.round(dot * 1000) / 1000 });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
};

const sameCharacter = (a, b) => a.character && a.character === b.character;

/** Every rule above. Returns { errors: string[], pairs, maxSimilarity }. */
export const checkSignatures = (bears, { limit = PROMPT_SIMILARITY_LIMIT } = {}) => {
  const errors = [];
  const ids = Object.keys(bears);
  for (const id of ids) {
    const bear = bears[id];
    for (const field of SIGNATURE_FIELDS) {
      const value = bear[field];
      const empty = Array.isArray(value) ? value.length === 0 : !String(value || '').trim();
      if (empty) errors.push(`${id}: missing signature field "${field}"`);
    }
    if (!Array.isArray(bear.palette) || bear.palette.length < 2 || bear.palette.length > 3) {
      errors.push(`${id}: palette needs 2-3 named colours`);
    }
    if (bear.styles !== undefined && !Array.isArray(bear.styles)) errors.push(`${id}: styles must be a list`);
    if (bear.name && bear.name_gag && !norm(bear.name_gag).includes(norm(bear.name))) {
      errors.push(`${id}: name_gag must say the name "${bear.name}"`);
    }
  }
  const seen = (label, keyOf, allowSameCharacter = false) => {
    const owner = new Map();
    for (const id of ids) {
      const key = keyOf(bears[id]);
      if (!key) continue;
      const other = owner.get(key);
      if (other && !(allowSameCharacter && sameCharacter(bears[other], bears[id]))) {
        errors.push(`${other} and ${id} share the same ${label}`);
      } else if (!other) owner.set(key, id);
    }
  };
  const palette = (bear) => (bear.palette || []).map(colourKey).sort().join('|');
  seen('medium', (bear) => norm(bear.medium));
  seen('medium + palette', (bear) => `${norm(bear.medium)}#${palette(bear)}`);
  seen('setting + prop', (bear) => `${norm(bear.setting)}#${norm(bear.prop)}`);
  seen('signature prop', (bear) => norm(bear.prop));
  seen('setting', (bear) => norm(bear.setting));
  seen('signature tuple', (bear) => SIGNATURE_FIELDS.filter((field) => field !== 'name' && field !== 'name_gag')
    .map((field) => norm(Array.isArray(bear[field]) ? bear[field].join(' ') : bear[field])).join('#'));
  // Palettes: two bears of the same kind of picture may share a hue, but
  // never the whole palette, and one's palette may not sit inside the other's.
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      if (mediumFamily(bears[ids[i]].medium) !== mediumFamily(bears[ids[j]].medium)) continue;
      const a = new Set((bears[ids[i]].palette || []).map(colourKey));
      const b = new Set((bears[ids[j]].palette || []).map(colourKey));
      const [small, big] = a.size <= b.size ? [a, b] : [b, a];
      if (small.size >= 2 && [...small].every((key) => big.has(key))) {
        errors.push(`${ids[i]} and ${ids[j]} are both ${mediumFamily(bears[ids[i]].medium)} in one palette (${[...small].join(', ')})`);
      }
    }
  }
  const pairs = promptSimilarity(bears);
  for (const pair of pairs) {
    if (pair.score <= limit) break;
    errors.push(`${pair.a} and ${pair.b} prompts are too alike (TF-IDF cosine ${pair.score} > ${limit})`);
  }
  return { errors, pairs, maxSimilarity: pairs.length ? pairs[0].score : 0 };
};

const isMain = () => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
};

if (isMain()) {
  const { readFileSync } = await import('node:fs');
  const { dirname, join, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const bibles = JSON.parse(readFileSync(join(root, 'art/bear-bibles.json'), 'utf8'));
  const top = Number(process.argv[process.argv.indexOf('--top') + 1]) || 0;
  const result = checkSignatures(bibles.bears);
  console.log(`${Object.keys(bibles.bears).length} bears, max prompt similarity ${result.maxSimilarity} (limit ${PROMPT_SIMILARITY_LIMIT})`);
  if (process.argv.includes('--top')) {
    for (const pair of result.pairs.slice(0, top)) console.log(`  ${pair.score}  ${pair.a}  ${pair.b}`);
  }
  for (const error of result.errors) console.error(`FAIL ${error}`);
  process.exit(result.errors.length ? 1 : 0);
}
