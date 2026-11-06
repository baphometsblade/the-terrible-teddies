# Legacy NSFW archive

Verbatim prompts, card text, and adult lines rescued from two private repos
before they were deleted. The live game uses a cut of this material (see
below). These copies are the rest, unchanged.

Nothing here is imported by the app. The files still say `@/integrations/...`
and `@google/genai` because that is how they were written.

## terrible-teddies-studio

From [Terrible-Teddies-Studio](https://github.com/baphometsblade/Terrible-Teddies-Studio)
(`src/services/geminiService.ts` at the time of the archive).

| File | What it is |
| --- | --- |
| `src/services/geminiService.ts` | Commentator prompt ("explicitly sexual with dark humor"), player-taunt prompt, debauched opponent persona and move prompt, card-designer prompt, image prompt suffix, and the canned lines used when `API_KEY` is missing. |
| `src/pregenerated-cards.ts` | The Bear-ristocrat card file: names, stories, image prompts. Includes Guard Cub. |
| `src/services/achievementService.ts` | "First Seduction", "Experienced Seducer", and the other achievement lines. |
| `metadata.json` | The game's own "naughty, adult" description. |
| `other-nsfw-strings.txt` | Note that a scan of the remaining source found no further NSFW strings. |

The root `services/geminiService.ts` in that repo was an empty file. The copy that matters is `src/services/geminiService.ts`.

## teddy-mischief-mania

From [teddy-mischief-mania](https://github.com/baphometsblade/teddy-mischief-mania).

| File | What it is |
| --- | --- |
| `src/utils/imageGeneration/nsfw-generator.ts` | `generateNSFWTeddyImage(card, mode: 'naughty' \| 'nasty')` and the asset prompts. |
| `src/utils/imageGeneration/promptUtils.ts` | Naughty/nasty description lists and `generatePromptForCard`. |
| `src/utils/imageGeneration/index.ts`, `src/utils/imageGeneration.ts` | The image-generation barrel those functions were exported from. |
| `src/utils/commentary.ts` | Naughty, nasty, and neutral commentary tables. |
| `src/utils/adultCardNaming.ts` | Suggestive names, domination names, special-move names, description templates, reaction lines. |
| `src/utils/suggestiveThemes.ts` | Voice lines by heat and intensity. |
| `src/utils/cardTypeUtils.ts`, `src/utils/cardEffectUtils.ts` | Card-type copy that talks about the two heats. |
| `src/utils/huggingface/constants.ts` | Hugging Face model notes for the NSFW generator. |
| `src/utils/stableDiffusion/` | Game-asset and image-option prompts. |
| `src/components/GameBoard/BattleDialogue/SuggestiveDialogues.ts` | The long naughty/nasty dialogue tables. |
| `src/components/GameBoard/SuggestiveDialogue.tsx` | The component that spoke those lines. |
| `src/components/GameBoard/AdultGameplay/SeductionSystem.ts` | Seduction effects and their descriptions. |
| `src/components/GameBoard/AdultGameplay/DominanceSystem.ts` | Dominance effects and their descriptions. |
| `src/components/GameBoard/Battle/AdultMechanics.ts` | The adult-mechanics hook those systems used. |
| `src/components/GameBoard/FlirtyEmotes/EmotePanel.tsx` | Flirty emote labels. |
| `src/components/HomePage/GameSection/GameContent/data/exampleCards.ts` | Fluffy Seducer, Velvet Dominator, Honey Dripper. |
| `src/components/Settings/AdultContentSettings.tsx` | The old naughty/nasty settings copy. |
| `src/components/AdminTools/.../PromptTemplates.tsx` | Stable Diffusion prompt templates. |
| `src/components/AdminTools/CardEnhancement/imageGeneration.ts`, `grokImageGeneration.ts` | Card image prompt builders. |
| `src/services/voicePlayerService.ts` | Voice-line playback for the suggestive themes. |
| `supabase/functions/huggingface-image-generator/index.ts` | The naughty/nasty prompt prefixes the generator actually sent. |
| `supabase/functions/generate-teddy-image/` | `promptGenerator.ts`, `enhancedPromptGenerator.ts`, `stableDiffusionGenerator.ts`. |
| `supabase/functions/analyze-teddy-image/aiAnalysis.ts` | Image-analysis prompt. |
| `supabase/functions/replicate-image-generator/index.ts` | Replicate image prompt path. |
| `supabase/functions/generate-game-assets/index.ts` | Asset prompts. |
| `other-nsfw-strings.txt` | Every other NSFW string literal in that repo (login copy, homepage blurbs, one-off prompts) that lived in a UI file rather than one of the tables above. |

## What the live game uses

- **Booth lines** (`src/lib/booth.js`), logged as `Booth: "…"` at the deal and at each later player turn. Naughty is the default. `VITE_BOOTH_HEAT=nasty` uses the rougher pool. Lines are capped at 78 characters so they fit a log entry.
- **Optional commentator** (`src/lib/boothAi.js`). The Studio system prompt and the debauched persona. If `VITE_GEMINI_API_KEY` is unset, or the call fails, or the answer does not fit, the booth stays on the canned line. No key is required to play.
- **Art heat** (`src/lib/nsfwArt.js`, `scripts/generate-card-art.mjs`). `ART_HEAT=naughty|nasty` appends a short tail. `ART_SFW=1` strips that tail and the usual `, raunchy NSFW` marker. `generateNsfwTeddyImage` posts to `FOOOCUS_URL` when one is set and returns null otherwise.

## What stays in this folder only

- Guard Cub, and any line that frames the bears as children's toys getting sexual after the kids are asleep. This game does not ship child-coded characters.
- Non-consent punchlines from the naming tables ("No Consent", "Forced Entry", "Forced Submission", "No Safe Word", and the descriptions that match them). The archive keeps them so the deletion does not erase them. The booth does not say them.
- Seduction and dominance as combat systems. They targeted stats this game does not have (`fluff`, a charm meter). The descriptions are in the booth where they fit; the rules are not wired in.
- The Gemini opponent that picked `PLAY_CARD` / `ACTIVATE_HAUNTING` moves. This game's opponent is the deterministic one in `src/utils/opponentAI.js`. The persona text is what the optional remark uses.
- The Hugging Face and Replicate clients. Image calls go through the Fooocus path this repo already had, or they no-op.
