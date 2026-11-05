import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The two repos this was rescued from are being deleted. These files are the
// verbatim prompts and card text. If one goes missing, the rescue failed.
const root = resolve(process.cwd(), 'docs/legacy-nsfw');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

describe('legacy NSFW archive', () => {
  it('keeps the Studio commentator, the debauched opponent, and the card text', () => {
    const gemini = read('terrible-teddies-studio/src/services/geminiService.ts');
    expect(gemini).toContain('explicitly sexual with dark humor');
    expect(gemini).toContain('utterly debauched');
    expect(gemini).toContain('The teddies are eerily silent...');
    expect(gemini).toContain("think of you naked");
    const cards = read('terrible-teddies-studio/src/pregenerated-cards.ts');
    expect(cards).toContain('Pillow Biter');
    expect(cards).toContain('Debaucherous Duke');
    expect(cards).toContain('Guard Cub');
    expect(read('terrible-teddies-studio/src/services/achievementService.ts')).toContain('First Seduction');
  });

  it('keeps the mania generator, heats, commentary, and card names', () => {
    expect(read('teddy-mischief-mania/src/utils/imageGeneration/nsfw-generator.ts')).toContain('generateNSFWTeddyImage');
    const hf = read('teddy-mischief-mania/supabase/functions/huggingface-image-generator/index.ts');
    expect(hf).toContain('seductive pose, playful, flirty expression');
    expect(hf).toContain('torn fabric, spiky accessories');
    expect(read('teddy-mischief-mania/src/utils/commentary.ts')).toContain("That's a flirty little move!");
    expect(read('teddy-mischief-mania/src/utils/adultCardNaming.ts')).toContain('Velvet Pounder');
    expect(read('teddy-mischief-mania/src/utils/suggestiveThemes.ts')).toContain('Was it good for you too?');
    expect(read('teddy-mischief-mania/src/components/GameBoard/BattleDialogue/SuggestiveDialogues.ts')).toContain("Mmm, that's a naughty move...");
    expect(read('teddy-mischief-mania/src/components/HomePage/GameSection/GameContent/data/exampleCards.ts')).toContain('Honey Dripper');
  });
});
