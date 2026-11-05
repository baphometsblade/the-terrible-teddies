// Optional Gemini remark for the booth. There is no LLM client in this repo,
// so this is a plain fetch against the Generative Language API, and only
// when VITE_GEMINI_API_KEY is set. Anything else — no key, a refusal, a
// network error, a line that will not fit the log — returns a canned booth
// line. The key is never written into a log line.

import { BOOTH_MAX, pickBooth } from './booth';

// The commentator brief from Terrible Teddies Studio's geminiService, plus
// the two floors this game already holds (no minors, no non-consent joke).
// The verbatim prompt, without those floors, is in docs/legacy-nsfw.
export const COMMENTATOR_PROMPT = `You are the snarky, raunchy, and unapologetically adult commentator for 'Terrible Teddies'.
The theme is scandalous, decadent, and explicitly sexual with dark humor.
Your comments should be short, witty, biting, and hilarious NSFW remarks in the third person.
Generate a single biting NSFW comment about what just happened.
One line, under ${BOOTH_MAX} characters, no quotes.
Nothing sexual involving minors. No non-consent punchline. No slurs.`;

// The opponent persona from the same file. This game's moves stay with the
// deterministic opponent; the persona is what an optional remark sounds like.
export const OPPONENT_PERSONA =
  'Your personality is cunning, arrogant, and utterly debauched. Your reasoning should reflect this lewd and superior attitude.';

const MODEL = 'gemini-2.5-flash';

function oneLine(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
}

/**
 * A booth line. `options.apiKey` (or VITE_GEMINI_API_KEY) enables the call.
 * `options.fetch` injects a fake fetch in tests. `options.pool` picks the
 * canned fallback ('turn' by default). `options.heat` is 'naughty' or 'nasty'.
 */
export async function boothRemark(situation, options = {}) {
  const pool = options.pool || 'turn';
  const heat = options.heat === 'nasty' ? 'nasty' : 'naughty';
  const last = options.last ?? null;
  const fallback = () => pickBooth(pool, last, heat);
  const apiKey = options.apiKey
    ?? (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GEMINI_API_KEY : undefined);
  if (!apiKey) return fallback();

  const fetchFn = options.fetch;
  if (typeof fetchFn !== 'function') return fallback();

  const text = typeof situation === 'string' ? situation : situation?.text;
  const body = {
    contents: [{
      parts: [{
        text: `${COMMENTATOR_PROMPT}\n\n${OPPONENT_PERSONA}\n\nCurrent Situation: ${text || 'Something filthy just happened at the bar.'}`,
      }],
    }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 50 },
  };

  try {
    const res = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res?.ok) return fallback();
    const data = await res.json();
    const line = oneLine(data?.candidates?.[0]?.content?.parts?.[0]?.text);
    if (!line || line.length > BOOTH_MAX) return fallback();
    return line;
  } catch {
    return fallback();
  }
}

/**
 * Write one booth line into the battle log. Always canned, so a turn never
 * waits on the network. When a Gemini key is set, a second line may follow
 * if the model answers with something that fits.
 */
export function noteBooth(addToLog, lastRef) {
  const heat = import.meta.env?.VITE_BOOTH_HEAT === 'nasty' ? 'nasty' : 'naughty';
  const canned = pickBooth('turn', lastRef?.current ?? null, heat);
  if (canned) {
    if (lastRef) lastRef.current = canned;
    addToLog(`Booth: "${canned}"`);
  }
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY;
  if (!apiKey) return;
  void boothRemark({
    text: 'A turn is starting at the bar. Comment on it.',
    pool: 'turn',
    heat,
    last: canned,
    apiKey,
  }).then((line) => {
    if (!line || line === canned) return;
    if (lastRef) lastRef.current = line;
    addToLog(`Booth: "${line}"`);
  });
}
