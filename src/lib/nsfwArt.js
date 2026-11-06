// Naughty / nasty art prompts from teddy-mischief-mania's
// generateNSFWTeddyImage and the Hugging Face enhancer, adapted to this
// repo's art pipeline. The subjects stay plush toys. ART_SFW is the same
// switch scripts/generate-card-art.mjs already uses: when it is on, the
// extra heat is omitted and the prompt falls back to a plain teddy.

const SFW_ON = /^(1|true|yes|on)$/i;

export const NSFW_NEGATIVE =
  'deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, low quality, text, watermark, signature, human, person, people';

// Verbatim enhancers from supabase/functions/huggingface-image-generator.
const NAUGHTY_PREFIX =
  'fantasy teddy bear, stuffed animal, seductive pose, playful, flirty expression, cute, adult-themed, high quality, suggestive outfit, romantic setting';
const NASTY_PREFIX =
  'fantasy teddy bear, stuffed animal, battle-ready, aggressive pose, menacing, fierce, fantasy battle scene, torn fabric, spiky accessories, dark atmosphere, high quality';
const PLAIN_PREFIX = 'fantasy teddy bear, stuffed animal, colorful, vibrant, magical, cute pose, high quality';

// Short tails for the card-art generator. They are opt-in (ART_HEAT) because
// the default deck already sits on CLIP's 77-token ceiling; appending them
// to every card is a deliberate regen, not the shipped prompt.
const HEAT_TAIL = {
  naughty: 'seductive pose, flirty expression, suggestive outfit',
  nasty: 'aggressive pose, torn fabric, dark boudoir lighting',
};

function envOf(env) {
  return env ?? {};
}

export function artIsSfw(env) {
  return SFW_ON.test(envOf(env).ART_SFW ?? '');
}

/**
 * Extra clause for promptFor(), or '' when the pass is SFW or no heat was
 * asked for. ART_SFW wins over ART_HEAT.
 */
export function heatClause(env) {
  const source = envOf(env);
  if (artIsSfw(source)) return '';
  const heat = String(source.ART_HEAT ?? '').toLowerCase();
  return HEAT_TAIL[heat] ?? '';
}

function subjectOf(card) {
  if (typeof card === 'string') return card.trim() || 'teddy bear';
  if (card && typeof card === 'object') {
    const subject = card.visual || card.name || card.description;
    if (subject) return String(subject).trim();
  }
  return 'teddy bear';
}

/**
 * The prompt generateNSFWTeddyImage built, minus the Supabase call.
 * `card` is a name, a visual, or a card with name/visual/description.
 * mode is 'naughty' (default) or 'nasty'. ART_SFW drops the adult prefix.
 */
export function nsfwTeddyPrompt(card, mode = 'naughty', env) {
  const name = subjectOf(card);
  if (artIsSfw(env)) return `${PLAIN_PREFIX}, ${name}`;
  const prefix = mode === 'nasty' ? NASTY_PREFIX : NAUGHTY_PREFIX;
  return `${prefix}, ${name}`;
}

/**
 * Ask a Fooocus-compatible endpoint for one image. Returns a base64 string,
 * or null when no endpoint is configured or the call fails. Keys and the
 * endpoint come from the env passed in (FOOOCUS_URL, FOOOCUS_AUTH), never
 * from source.
 */
export async function generateNsfwTeddyImage(card, mode = 'naughty', options = {}) {
  const env = envOf(options.env);
  const endpoint = options.endpoint ?? env.FOOOCUS_URL ?? env.VITE_FOOOCUS_URL;
  const prompt = nsfwTeddyPrompt(card, mode, env);
  if (!endpoint) return null;
  const fetchFn = options.fetch;
  if (typeof fetchFn !== 'function') return null;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (env.FOOOCUS_AUTH) headers.Authorization = env.FOOOCUS_AUTH;
    const res = await fetchFn(`${String(endpoint).replace(/\/$/, '')}/v1/generation/text-to-image`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        negative_prompt: NSFW_NEGATIVE,
        aspect_ratios_selection: '896*1152',
        image_number: 1,
        require_base64: true,
        async_process: false,
      }),
    });
    if (!res?.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : data;
    const image = first?.base64 ?? first?.image ?? null;
    return typeof image === 'string' && image.length > 0 ? image : null;
  } catch {
    return null;
  }
}
