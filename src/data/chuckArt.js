// Art prompts for Chuck's Crew. Same shape as the rest of CARD_ART.
// Short on purpose: CLIP keeps 77 tokens, and the scene is the part it cuts.
// Chuck is the same honey-brown bartender on every card that is him.

export const CHUCK_ART = {
  'ck-chuck': {
    medium: 'Dutch tavern genre painting',
    fur: 'honey brown',
    visual: 'adult barrel-chested bartender bear, bow tie, teal shirt, gold tooth, bar towel on his shoulder',
    scene: 'Leaning on the bar with a gentle smile that is plainly a lie as a rowdy tavern of teddies spills ale.',
  },
  'ck-closing': {
    medium: 'public-works mural',
    fur: 'honey brown',
    visual: 'adult barrel-chested bartender bear, bow tie, teal shirt, gold tooth, ringing a huge brass bell',
    scene: 'Heaving the last-orders bell like a heroic worker over a sea of empty glasses, a clock behind.',
  },
  'ck-offduty': {
    medium: '60s pool painting',
    fur: 'honey brown',
    visual: 'adult barrel-chested bartender bear, shirt half off, bow tie, sunglasses up, gold tooth',
    scene: 'Swigging a confiscated bottle in a deckchair beside a turquoise pool with a big white splash.',
  },
  'ck-rita': {
    medium: 'cross-stitch sampler',
    fur: 'russet',
    visual: 'adult curvy bear in a cherry-red cardigan on her reserved bar stool, legs crossed, cocktail',
    scene: 'Stitched into a linen sampler in an embroidery hoop, cherries in the border.',
  },
  'ck-tabitha': {
    medium: 'paper quilling art',
    fur: 'burgundy',
    visual: 'adult sly bear made of coiled receipt-paper quills, burgundy curls',
    scene: 'Sitting among spirals of quilled bar-tab paper on a pale backdrop.',
  },
  // Each special shows its in-game effect as a photo gag (Mark, 19 Nov 2026).
  // Three specials are Chuck in the act, each in its own setting. The full
  // signatures live in art/bear-bibles.json (character: chuck, or plush: false
  // for the two battle cards).
  'ck-last-orders': {
    medium: 'ringside boxing-corner spotlight photo',
    visual: 'battered Chuck springing off the corner stool flexing as a cornerwoman tips a pint into him',
    scene: 'Last call on the ropes: red ropes, blue canvas, one spotlight, his gloved cornerwoman fired up behind him.',
  },
  // Top-Up and The Quiet Word are pure battle cards (Mark, 19 Nov 2026):
  // object still lifes, no Chuck, no plush, no people.
  'ck-top-up': {
    medium: 'hard-daylight pool-deck still-life photo',
    visual: 'a magnum pouring over plaster-patched coupes that it tops up on the way down',
    scene: 'White marble rooftop infinity pool, cyan water, a sagging pink pool ring filling with foam.',
  },
  'ck-cut-off': {
    medium: 'fluorescent convenience-store night photo',
    visual: 'Chuck snipping the energy-drink fridge cable with gold scissors, the bolt neons going dark',
    scene: '3 a.m. white tiles, sparks at the cut, an outraged tiara-wearing patron reaching for a dead can.',
  },
  'ck-on-the-tab': {
    medium: 'sunlit bottomless-brunch lifestyle photo',
    visual: 'Chuck toasting with a mimosa in each paw, two cards in his bow tie, the receipt chained to his ankle',
    scene: 'Pink-and-white cafe, an ice pack and a fizzing hangover tablet waiting on the table for tomorrow.',
  },
  'ck-quiet-word': {
    medium: 'neon-haze lounge macro still-life photo',
    visual: 'a lipstick-kissed gold microphone baiting a steel jaw trap snapped shut on a brass knuckleduster',
    scene: 'Violet velvet, blue and violet neon haze, one finger ring flying off in sparks.',
  },
};
