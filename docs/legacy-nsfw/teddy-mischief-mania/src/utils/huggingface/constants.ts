
// Available models for the Hugging Face image generation
export const HUGGINGFACE_MODELS = {
  'FLUX.1-schnell': 'black-forest-labs/FLUX.1-schnell',
  'Stable Diffusion XL': 'stabilityai/stable-diffusion-xl-base-1.0',
  'Playground v2': 'playgroundai/playground-v2.5-1024px-aesthetic',
  'Anime Pastel': 'cagliostrolab/animagine-xl-3.0',
  'Dreamshaper': 'Lykon/dreamshaper-xl-turbo'
};

// Default model to use
export const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';

// Prompt templates for teddy generation
export const TEDDY_PROMPT_TEMPLATES = {
  naughty: "fantasy teddy bear, stuffed animal, seductive pose, playful, flirty expression, cute, adult-themed, high quality, suggestive outfit, romantic setting, soft lighting, pink and purple tones",
  nasty: "fantasy teddy bear, stuffed animal, battle-ready, aggressive pose, menacing, fierce, fantasy battle scene, torn fabric, spiky accessories, dark atmosphere, high quality",
  regular: "fantasy teddy bear, stuffed animal, colorful, vibrant, magical, cute pose, high quality"
};

// Background prompt templates
export const BACKGROUND_PROMPT_TEMPLATES = {
  naughty: "romantic fantasy room interior, soft lighting, silk drapes, plush cushions, heart motifs, intimate atmosphere, no text, no people",
  nasty: "dark fantasy battle arena, dramatic lighting, broken weapons, magical energy, ominous atmosphere, no text, no people",
  regular: "fantasy game background, magical environment, vibrant colors, mystical elements, no text, no people"
};

// Card back prompt templates
export const CARD_BACK_PROMPT_TEMPLATES = {
  naughty: "ornate card back design, heart symbols, romantic patterns, pink and purple, luxury gold trim, no text",
  nasty: "dark fantasy card back design, skull motifs, aggressive patterns, purple and black, silver spikes, no text",
  regular: "fantasy card back design, magical symbols, balanced colors, ornate patterns, golden trim, no text"
};

// Default negative prompt
export const DEFAULT_NEGATIVE_PROMPT = "deformed, bad anatomy, disfigured, poorly drawn, bad proportions, blurry, low quality, text, watermark, signature, human, person, people";
