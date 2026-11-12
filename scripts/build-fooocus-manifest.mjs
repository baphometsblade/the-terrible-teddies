/**
 * Writes art/fooocus-manifest.json from the live card catalog.
 *
 * Run: npx vite-node scripts/build-fooocus-manifest.mjs
 *
 * Expansion cards from the other agents do not belong here. They go in
 * art/fooocus-manifest.d/*.json so a rebuild of this file cannot wipe them.
 */
import { writeFileSync } from 'node:fs';
import { BEAR_GUARD, composePrompt, composeNegative } from './bear-bibles.mjs';

globalThis.localStorage ??= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { ALL_CARDS } = await import('@/stores/gameStore');
const { CARD_ART } = await import('@/data/cardArt');
const { BOSS_CARD } = await import('@/lib/houseRules');

// Bears share only the plush guard. Everything else comes from art/bear-bibles.json.
const BEAR = BEAR_GUARD;
const OBJECT = 'RAW photo, photoreal object, cinematic shallow depth of field, on a sticky dive-bar table, warm amber practical light, magenta neon, rich saturated colour, raunchy NSFW';
const NEGATIVE = 'cartoon, illustration, drawing, anime, 3d render, cgi, plastic, human, person, human skin, child, children, kid, kids, baby, toddler, teen, minor, underage, cub, loli, shota, watermark, text, letters, logo, signature, extra limbs, deformed, blurry, lowres, frame, border';
const BROWNISH = /brown|tan|chocolate|espresso|caramel|amber|auburn|khaki|russet|beige|oxblood/i;

const GOONS = [
  { id: 101, name: 'Repo Ted', type: 'action', medium: '80s toy-commercial VHS still', fur: 'gunmetal grey', visual: 'adult burly bear in a hi-vis vest and cap with a tow hook', scene: 'Hooking a tiny toy car onto his toy tow truck while a smaller teddy protests.' },
  { id: 102, name: 'Loan-Shark Larry', type: 'action', medium: 'aquarium-glass photo', fur: 'silver white', visual: 'adult sleek bear in a shark-fin hat and pinstripe suit, gold tooth', scene: 'Counting a fat stack of cash at a desk while sharks circle in the tank wall behind.' },
  { id: 103, name: 'Off-the-Grid Greg', type: 'action', medium: 'corkboard flash photo', fur: 'sand beige', visual: 'adult twitchy bear in tinfoil and a foil hat, mismatched button eyes', scene: 'Ripping a coiled phone cord from the wall in front of a corkboard of red string and maps.' },
  { id: 104, name: 'Unhinged Cuddles', type: 'action', medium: '80s horror VHS cover', fur: 'bubblegum pink', visual: 'adult bear with a too-wide stitched grin, stuffing bursting from popped seams', scene: 'Lunging for a hug out of a dark green hallway on a scuffed tape cover.' },
  { id: 105, name: 'Whiskey Whiskers', type: 'action', medium: 'scrimshaw on ivory', fur: 'ivory', visual: 'adult round bear carved in ivory with a vast whiskey-soaked handlebar moustache', scene: 'Fine black scrimshaw lines on whale-bone ivory, one amber whiskey glint.' },
  { id: 106, name: 'Landlord Lucifur', type: 'action', medium: 'Chicano airbrush mural', fur: 'devil red', visual: 'adult horned bear with a felt tail and a pitchfork', scene: 'Knocking for the rent at a blue door of a pink apartment block hung with marigolds.' },
  { id: 108, name: 'Void Where Prohibited', type: 'action', medium: 'glitch art', fur: 'matte void black', visual: 'adult bear with glowing hollow eyes melting into corrupted pixels', scene: 'Perched on a broken TV leaking colour bars, half of him datamoshed away.' },
];

const DONNA = {
  id: 109,
  name: 'Door-Staff Donna',
  type: 'action',
  medium: 'cyberpunk rain-neon photo',
  fur: 'jet black',
  visual: 'adult tall bear in a puffer jacket and headset, unimpressed stare',
  scene: 'Holding a club door shut with one paw in pouring rain, neon puddles and a sagging rope beside her.',
};

const negativeFor = (card) => (
  card.type === 'action' && card.fur && !BROWNISH.test(card.fur)
    ? `${NEGATIVE}, brown fur, tan fur, beige fur`
    : NEGATIVE
);

const cardOutputs = (id) => ([
  { path: `public/cards/${id}.webp`, width: 768, height: 1024, format: 'webp' },
  { path: `public/cards/thumbs/${id}.webp`, width: 192, height: 256, format: 'webp' },
]);

const cardEntry = (card, art = {}) => {
  const bear = card.type === 'action';
  const visual = art.visual || card.visual || card.description || card.name;
  const scene = art.scene || card.scene || 'Inside a neon dive bar.';
  const fur = art.fur || card.fur;
  const specifics = bear
    ? `${fur} fur, ${visual}. ${scene} Clearly a grown bear.`
    : `${visual}. ${scene}`;
  const prefix = bear ? 'bear' : 'object';
  return {
    id: String(card.id),
    name: card.name,
    type: 'card',
    prefix,
    path: `public/cards/${card.id}.webp`,
    width: 768,
    height: 1024,
    aspect_ratio: '896*1152',
    performance: 'Speed',
    prompt: (bear && composePrompt(card.id)) || `${bear ? BEAR : OBJECT}, ${specifics}`,
    negative_prompt: (bear && composeNegative(card.id)) || negativeFor({ ...card, ...art, fur }),
    outputs: cardOutputs(card.id),
  };
};

const cards = [
  ...ALL_CARDS.map((card) => cardEntry(card, CARD_ART[card.id])),
  ...GOONS.map((card) => cardEntry(card, card)),
  cardEntry(DONNA, DONNA),
];

cards.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

const iconPrompt = 'App icon, RAW photo, one adult plush teddy bear bartender, teal shirt, holding a playing card, photoreal worn fur, wood dive bar, warm amber practical light, magenta neon sign, cinematic shallow depth of field, rich saturated colour, tongue-in-cheek, no text, no letters';
const scenePrompt = 'Wide cinematic RAW photo, adult plush teddy bears closing a dive bar, photoreal worn fur, warm amber practicals, magenta and cyan neon, sticky wood bar, cinematic shallow depth of field, rich saturated colour, raunchy NSFW, tongue-in-cheek, no text, no letters';

const manifest = {
  style_prefix: { bear: BEAR, object: OBJECT },
  negative_prompt: NEGATIVE,
  cards: [
    ...cards,
    {
      id: 'pwa-icon',
      name: 'App icon',
      type: 'icon',
      prefix: 'icon',
      path: 'public/icon-512.png',
      width: 512,
      height: 512,
      aspect_ratio: '1024*1024',
      performance: 'Quality',
      prompt: iconPrompt,
      negative_prompt: NEGATIVE,
      outputs: [
        { path: 'public/icon-512.png', width: 512, height: 512, format: 'png' },
        { path: 'public/icon-192.png', width: 192, height: 192, format: 'png' },
        { path: 'public/apple-touch-icon.png', width: 180, height: 180, format: 'png' },
        { path: 'public/favicon.png', width: 48, height: 48, format: 'png' },
        { path: 'public/favicon.ico', width: 32, height: 32, format: 'ico' },
        { path: 'public/icon-maskable-512.png', width: 512, height: 512, format: 'png', inset: 0.8, background: '#100e0c' },
        { path: 'public/icon-maskable-192.png', width: 192, height: 192, format: 'png', inset: 0.8, background: '#100e0c' },
      ],
    },
    {
      id: 'og-image',
      name: 'Share image',
      type: 'social',
      prefix: 'scene',
      path: 'public/og-image.jpg',
      width: 1200,
      height: 630,
      aspect_ratio: '1408*704',
      performance: 'Quality',
      prompt: scenePrompt,
      negative_prompt: NEGATIVE,
      outputs: [
        { path: 'public/og-image.jpg', width: 1200, height: 630, format: 'jpeg', quality: 82 },
      ],
    },
  ],
};

writeFileSync('art/fooocus-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${manifest.cards.length} assets to art/fooocus-manifest.json`);
