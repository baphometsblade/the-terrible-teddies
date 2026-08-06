import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ALL_CARDS } from '@/stores/gameStore';
import { CARD_ART } from './cardArt';

// Guards the art prompts against CLIP's 77-token ceiling.
//
// The bug this exists to prevent: an NSFW register marker was added to every
// prompt, and it cost ~13 tokens. Measured with the real CLIP tokenizer
// (openai/clip-vit-large-patch14), the prompt set had exactly ONE token of
// headroom, so the marker pushed 29 of 72 prompts past the limit, peaking at 89.
// CLIP discards the overflow silently — no error, no warning, nothing in the
// output — and what it discarded was the tail of the prompt: the `scene` clause
// carrying each card's action, camera angle and lighting. That field exists
// specifically so 60+ bears don't all read as the same portrait, so the NSFW
// pass was quietly undoing the differentiation work on 40% of the set.
//
// Nothing could catch it: the generator runs outside the test suite and only
// talks to a GPU endpoint, and CLIP truncation is not an error condition.

// Mirrors promptFor() in scripts/generate-card-art.mjs. Kept in sync by the
// structure test below, which fails if that template changes shape.
const ADULT = ', raunchy NSFW';
const buildPrompt = (card, art) => {
  const subject = art.visual || card.description || card.name;
  const scene = art.scene || '';
  if (card.type === 'trap' || card.type === 'special') {
    return `Product photo${ADULT}, single object filling the frame — ${subject}. ${scene}`;
  }
  const fur = art.fur ? `${art.fur} ` : '';
  return `RAW photo, ${fur}plush teddy bear, ${fur}fur${ADULT} — ${subject}. ${scene}`;
};

// Pure-JS stand-in for CLIP's BPE tokenizer. Calibrated against the real
// tokenizer (openai/clip-vit-large-patch14) over 144 prompts — the SFW and NSFW
// variants of all 72 cards — where it landed within -5/+6 tokens, mean -0.2.
//
// It is a tripwire, not a model of CLIP. The authoritative check was run with
// the real tokenizer: the current set peaks at 77 tokens with ZERO prompts
// truncated. This guard exists to fail the build if a future edit grows a scene
// or the register marker materially beyond that verified state. To re-verify
// exactly, dump the prompts and run them through the real tokenizer:
//
//   npx vite-node scripts/generate-card-art.mjs -- --dry-run
//
// then tokenize with transformers' CLIPTokenizerFast and confirm max <= 77.
function estimateClipTokens(text) {
  const pieces = text.match(/[A-Za-z0-9']+|[^\sA-Za-z0-9]/g) ?? [];
  let n = 0;
  for (const w of pieces) {
    n += w.length <= 7 ? 1 : 1 + Math.ceil((w.length - 7) / 5);
  }
  return n + 2; // CLIP's BOS + EOS both count against the 77
}

// Today's verified-good set estimates at max 78 (real max 77, none truncated).
// 80 sits just above that: tight enough that adding a clause to the longest
// scenes trips it, loose enough that the estimator's own +/-5 noise does not
// fail a set the real tokenizer accepts.
const BUDGET = 80;

describe('card art prompts fit inside CLIP’s 77-token window', () => {
  const cards = ALL_CARDS.filter((c) => CARD_ART[c.id]);

  it('has art for every card', () => {
    expect(cards.length).toBe(ALL_CARDS.length);
  });

  it('no prompt overflows, so no card silently loses its scene clause', () => {
    const over = [];
    for (const card of cards) {
      const prompt = buildPrompt(card, CARD_ART[card.id]);
      const tokens = estimateClipTokens(prompt);
      if (tokens > BUDGET) over.push(`#${card.id} ${card.name}: ~${tokens} tokens (budget ${BUDGET})`);
    }
    expect(
      over,
      `These prompts would be cut off by CLIP, losing the tail of their scene ` +
        `clause — the per-card action/camera/lighting that stops every bear ` +
        `reading as the same portrait:\n  ${over.join('\n  ')}\n` +
        `Shorten the scene text in src/data/cardArt.js, or the register marker ` +
        `in scripts/generate-card-art.mjs.`
    ).toEqual([]);
  });

  it('the prompt template still matches the generator', () => {
    // If promptFor()'s shape changes, this mirror goes stale and the budget
    // check silently measures the wrong string.
    const src = readFileSync(resolve(process.cwd(), 'scripts/generate-card-art.mjs'), 'utf8');
    expect(src).toContain('RAW photo, ${fur}plush teddy bear, ${fur}fur${ADULT} — ${subject}. ${scene}');
    expect(src).toContain('Product photo${ADULT}, single object filling the frame — ${subject}. ${scene}');
    expect(src).toContain("const ADULT = SFW ? '' : ', raunchy NSFW';");
  });
});

