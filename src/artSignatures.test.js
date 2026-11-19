// @vitest-environment node
/**
 * Bear signature uniqueness (Mark, Nov 2026: "the bears are very heavily
 * stylized towards their name so they're individualizable by eye").
 *
 * Every bear in art/bear-bibles.json has an explicit signature, and the set
 * must not overlap: scripts/bear-signatures.mjs holds the rules, this suite
 * runs them on the real bibles and proves each rule fires on a planted clash.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  checkSignatures, colourKey, fieldsFor, isPlush, mediumFamily, promptSimilarity, signatureText,
  PROMPT_SIMILARITY_LIMIT, PLUSH_ONLY_FIELDS,
} from '../scripts/bear-signatures.mjs';
import {
  composePrompt, composeNegative, stylesFor, BEAR_GUARD, OBJECT_GUARD, MEDIUM_WEIGHT, GAG_WEIGHT,
} from '../scripts/bear-bibles.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIBLES = JSON.parse(readFileSync(join(ROOT, 'art/bear-bibles.json'), 'utf8'));
const BEARS = BIBLES.bears;
const clone = () => JSON.parse(JSON.stringify(BEARS));

describe('bear signatures', () => {
  it('give every bear a full signature', () => {
    expect(Object.keys(BEARS).length).toBeGreaterThanOrEqual(117);
    for (const [id, bear] of Object.entries(BEARS)) {
      // Pure battle cards (plush: false) have no fur/outfit; every other field is required.
      for (const field of fieldsFor(bear)) expect(bear[field], `${id}.${field}`).toBeTruthy();
      expect(bear.palette.length, id).toBeGreaterThanOrEqual(2);
      expect(bear.palette.length, id).toBeLessThanOrEqual(3);
      expect(bear.name_gag.toLowerCase(), id).toContain(bear.name.toLowerCase());
    }
  });

  it('pass every uniqueness rule on the real set', () => {
    const { errors, maxSimilarity } = checkSignatures(BEARS);
    expect(errors).toEqual([]);
    expect(maxSimilarity).toBeLessThanOrEqual(PROMPT_SIMILARITY_LIMIT);
  });

  it('fail two bears with the same medium and palette', () => {
    const bears = clone();
    bears['2'].medium = bears['1'].medium;
    bears['2'].palette = [...bears['1'].palette];
    const { errors } = checkSignatures(bears);
    expect(errors.some((e) => e.includes('same medium + palette'))).toBe(true);
    expect(errors.some((e) => e.includes('same medium'))).toBe(true);
  });

  it('fail two bears with the same setting and prop', () => {
    const bears = clone();
    bears['3'].setting = bears['1'].setting;
    bears['3'].prop = bears['1'].prop.toUpperCase();
    const { errors } = checkSignatures(bears);
    expect(errors.some((e) => e.includes('1 and 3 share the same setting + prop'))).toBe(true);
  });

  it('fail an identical signature tuple', () => {
    const bears = clone();
    bears.copy = { ...bears['1'], name: 'Copycat Ted', name_gag: 'Copycat Ted: the same bear twice' };
    const { errors } = checkSignatures(bears);
    expect(errors.some((e) => e.includes('same signature tuple'))).toBe(true);
  });

  it('fail two bears of one kind of picture in one palette, compared by hue', () => {
    expect(colourKey("Chuck's teal")).toBe(colourKey('thread teal'));
    expect(mediumFamily('Victorian steel engraving')).toBe('print');
    expect(mediumFamily('telephoto safari wildlife documentary photograph')).toBe('photo');
    const bears = clone();
    bears['2'].palette = ['ink black', 'cream', 'fuse orange'];
    bears['2'].medium = '1950s rubber-hose cartoon strip';
    bears['1'].medium = '1940s rubber-hose cartoon animation cel';
    const { errors } = checkSignatures(bears);
    expect(errors.some((e) => e.includes('1 and 2 are both'))).toBe(true);
  });

  it('flag prompts whose words are too alike', () => {
    const bears = clone();
    bears['2'] = { ...bears['2'], gag: bears['1'].gag, pose: bears['1'].pose, setting: `${bears['1'].setting}, again` };
    const pair = promptSimilarity(bears).find((p) => [p.a, p.b].sort().join() === '1,2');
    expect(pair.score).toBeGreaterThan(PROMPT_SIMILARITY_LIMIT);
    expect(checkSignatures(bears).errors.some((e) => e.includes('too alike'))).toBe(true);
  });

  it('fail a name gag that does not say the name', () => {
    const bears = clone();
    bears['1'].name_gag = 'a bear with a match';
    expect(checkSignatures(bears).errors).toContain('1: name_gag must say the name "Shitstarter Ted"');
  });

  it('let a pure battle card go without a plush identity, and only a battle card', () => {
    const battle = Object.entries(BEARS).filter(([, bear]) => !isPlush(bear)).map(([id]) => id).sort();
    expect(battle).toEqual(['ck-quiet-word', 'ck-top-up']);
    for (const id of battle) {
      expect(BEARS[id].kind, id).toBe('battle');
      for (const field of [...PLUSH_ONLY_FIELDS, 'character']) expect(BEARS[id][field], `${id}.${field}`).toBeUndefined();
      expect(signatureText(BEARS[id]), id).not.toMatch(/plush|teddy|chuck|bear/i);
    }
    const bears = clone();
    bears['ck-top-up'].fur = 'honey-brown';
    bears['1'].plush = false;
    delete bears['1'].fur;
    delete bears['1'].outfit;
    const { errors } = checkSignatures(bears);
    expect(errors).toContain('ck-top-up: battle card (plush: false) must not set "fur"');
    expect(errors).toContain('1: plush: false is only for kind "battle"');
    const missing = clone();
    delete missing['1'].fur;
    expect(checkSignatures(missing).errors).toContain('1: missing signature field "fur"');
  });

  it("leave Chuck's fixed look out of the comparison", () => {
    const text = signatureText(BEARS['ck-chuck']);
    expect(text).not.toContain('one gold tooth');
    expect(BEARS['ck-chuck'].character).toBe('chuck');
  });
});

describe('composed bear prompts', () => {
  it('lead with the weighted medium and gag, with the plush guard after', () => {
    // Every plush card carries the guard. Pure battle cards (plush: false) are
    // checked in the next test: they must carry no plush at all.
    for (const id of Object.keys(BEARS).filter((key) => isPlush(BEARS[key]))) {
      const prompt = composePrompt(id);
      expect(prompt.startsWith(`(${BEARS[id].medium}`), id).toBe(true);
      expect(prompt, id).toContain(`:${MEDIUM_WEIGHT})`);
      expect(prompt, id).toContain(`:${GAG_WEIGHT})`);
      expect(prompt.indexOf(BEAR_GUARD), id).toBeGreaterThan(prompt.indexOf(`:${GAG_WEIGHT})`));
      expect(prompt, id).toMatch(/stuffed plush teddy bear toy/);
      expect(prompt, id).toMatch(/not a human/);
      expect(composeNegative(id), id).toMatch(/minor/);
      expect(composeNegative(id), id).toMatch(/lettering/);
      expect(Array.isArray(stylesFor(id)), id).toBe(true);
    }
  });

  it('compose pure battle cards as object still lifes with no bear in them', () => {
    for (const id of Object.keys(BEARS).filter((key) => !isPlush(BEARS[key]))) {
      const prompt = composePrompt(id);
      expect(prompt.startsWith(`(${BEARS[id].medium}`), id).toBe(true);
      expect(prompt, id).toContain(`:${GAG_WEIGHT})`);
      expect(prompt, id).toContain(OBJECT_GUARD);
      expect(prompt, id).not.toContain(BEAR_GUARD);
      expect(prompt, id).not.toMatch(/plush|teddy|chuck|\bbears?\b|wearing|fur:/i);
      const negative = composeNegative(id);
      expect(negative, id).toMatch(/teddy bear, plush toy, stuffed animal/);
      expect(negative, id).toMatch(/minor/);
      expect(negative, id).toMatch(/lettering/);
      expect(negative, id).not.toMatch(/brown fur, tan fur, honey fur/);
    }
  });

  it('are what the manifests carry', () => {
    const rows = [
      ...JSON.parse(readFileSync(join(ROOT, 'art/fooocus-manifest.json'), 'utf8')).cards,
      ...['chuck', 'hen-do-havoc', 'last-orders', 'morning-after', 'naughty-list']
        .flatMap((name) => JSON.parse(readFileSync(join(ROOT, `art/fooocus-manifest.d/${name}.json`), 'utf8'))),
    ];
    let checked = 0;
    for (const row of rows) {
      if (!BEARS[row.id]) continue;
      expect(row.prompt, `${row.id}: run node scripts/bear-bibles.mjs`).toBe(composePrompt(row.id));
      expect(row.negative_prompt, row.id).toBe(composeNegative(row.id));
      expect(row.styles, row.id).toEqual(stylesFor(row.id));
      expect(row.performance, row.id).toBe('Quality');
      checked += 1;
    }
    expect(checked).toBe(Object.keys(BEARS).length);
  });
});
