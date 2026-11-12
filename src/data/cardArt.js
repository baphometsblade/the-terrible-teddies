/**
 * Card-art source data for every entry in ALL_CARDS (src/stores/gameStore.js),
 * keyed by card id: { fur, visual, scene }. Trap/special cards have no `fur`
 * (they aren't bears) — just `visual` and `scene`.
 *
 * This file exists ONLY as input to scripts/generate-card-art.mjs (the
 * build-time art-generation pipeline). It is deliberately NOT imported by any
 * app code, so this ~15 KB of prompt prose never ships in the client bundle —
 * see scripts/generate-card-art.mjs, which merges ALL_CARDS with CARD_ART to
 * reconstruct the full card+art object it prompts from.
 *
 * src/stores/cardSchema.test.js guards this file's completeness: every card
 * id in ALL_CARDS must have a matching entry here with a non-empty `visual`
 * and a non-empty, unique `scene` (and a non-empty `fur` for action cards),
 * and this file must not contain ids that no longer exist in ALL_CARDS.
 */

import { QUICKIE_ART } from './quickieArt';
import { NIGHT_TWO_ART } from './nightTwoArt';
import { HEN_DO_ART } from './henDoArt';
import { LAST_ORDERS_ART } from './lastOrdersArt';
import { MORNING_AFTER_ART } from './morningAfterArt';
import { CHUCK_ART } from './chuckArt';
import { NAUGHTY_LIST_ART } from './naughtyListArt';

export const CARD_ART = {
  1: { medium: "rubber-hose cartoon cel", fur: "chocolate brown", visual: "adult barrel-chested bear, torn ear, maniac grin, giant cartoon match", scene: "Crouched under a bar stool striking the match on his own backside to light a powder keg, stools wobbling in fear." },
  2: { medium: "fisheye camcorder still", fur: "ash grey", visual: "adult matted feral bear, stuffing tufts, dangling button eye, torn hoodie, pizza crust in his teeth", scene: "Fisheye up close, snarling on a tipped wheelie bin in a back alley at dusk, camcorder flash." },
  3: { medium: "kawaii sticker art", fur: "candy-floss pink", visual: "adult absurdly over-fluffed puffball bear, tiny paws, innocent smile, one rude middle paw raised", scene: "Floating on a rainbow sparkle cloud inside a thick white sticker outline, hearts everywhere." },
  4: { medium: "arcade fighting-game screenshot", fur: "rust red", visual: "adult lanky wiry bear, black eye, missing tooth, sleeveless flannel, mid flying kick", scene: "Leaping through an arcade-lit pub stage, peanuts and beer foam flying, no on-screen text." },
  5: { medium: "16mm police film still", fur: "patchwork plum and grey", visual: "adult scrawny patchwork bear, huge cross-stitches, wire mic taped to his chest", scene: "Leaning across a steel interrogation table to whisper behind his paw, two-way mirror behind, one swinging bulb." },
  6: { medium: "expressionist oil painting", fur: "faded pink", visual: "adult lanky bear, smug raised brow, huge stitched mouth, comedy mic", scene: "Mid-insult at the mic while the swirling club bends away and a front row of teddies reels back." },
  7: { medium: "Technicolor binocular still", fur: "moss green", visual: "adult scrawny moth-eaten bear, lace bra worn as a cap, binoculars to his button eyes", scene: "Peeking out of an overflowing laundry hamper, seen through a double-circle binocular vignette." },
  8: { medium: "lucha screenprint poster", fur: "charcoal grey", visual: "adult barrel-chested bear, cauliflower ear, sparkly lucha mask, heart-shaped champion belt", scene: "In the ring giving a smaller teddy a 'hug' that is plainly a sleeper hold, the victim's eyes rolling." },
  9: { medium: "tattoo flash ink drawing", fur: "dirty white", visual: "adult teddy head and paws sewn onto a fat pillow body, toothbrush shiv in the seam, sleepy smile", scene: "Drawn on yellowed flash paper among inked roses, daggers, a swallow and a bedside alarm clock." },
  10: { medium: "ukiyo-e woodblock print", fur: "mustard yellow", visual: "adult hulking bristling bear tearing a stress ball in half, steam curling from his ears like waves", scene: "Kneeling on a cracked tatami mat by a broken meditation cushion, steam crashing round him like woodblock waves." },
  11: { medium: "courtroom pastel sketch", fur: "slate grey", visual: "adult broad one-eyed bear, neck brace, court papers stapled across his chest, tape measure", scene: "Toes exactly on a taped line in court, stretching a tape measure toward the gallery with a wounded look." },
  12: { medium: "bodybuilding magazine photo", fur: "brick red", visual: "adult hulking bear, over-stuffed biceps, stuffing bursting from one arm, sweatband, tiny posing trunks", scene: "Double-biceps flex on a chrome gradient backdrop, seams straining, a giant protein shaker at his feet." },
  13: { medium: "bomber nose-art enamel", fur: "jet black", visual: "adult round singed bomb-shaped bear, lit fuse on his head, mouth open mid-swear", scene: "Riding a falling bomb like a rodeo, painted on a riveted olive fuselage with smoke puffs." },
  14: { medium: "embroidered patch on denim", fur: "raw cotton white", visual: "adult squat smug cotton-boll bear, top hat, pince-nez, fat roll of rent money", scene: "Sitting on faded denim among scattered banknotes, counting the rent with a smug grin." },
  15: { medium: "banknote intaglio engraving", fur: "dusty plum", visual: "adult lanky shifty sweating bear, slipping fake moustache, receipts in a shredder", scene: "Framed in an ornate banknote oval, feeding receipts into a shredder that spews confetti." },
  16: { medium: "grand-manner oil portrait", fur: "faded ash blonde", visual: "adult moth-eaten aristocrat bear, velvet smoking jacket, lopsided powdered wig, pawn ticket", scene: "Posing proudly before a crumbling country estate, a single lacy garter draped on the balustrade." },
  17: { medium: "embroidered medieval tapestry", fur: "dark auburn", visual: "adult hulking shaggy bear, horned helmet over one eye, drinking horn", scene: "Passed out on the deck of a stitched longship, a gull stealing his snack, embroidered waves below." },
  18: { medium: "chalkboard chalk drawing", fur: "gunmetal silver", visual: "adult stooped old bear, walrus moustache, bedpan helmet, teal cardigan of bottle-cap medals", scene: "Telling a tall war story against a blackboard of wild chalk battle-plan arrows." },
  19: { medium: "danse-macabre woodcut", fur: "bone pale grey", visual: "adult skeletal-thin hooded reaper bear, giant sewing scissors, pincushion heart", scene: "Leading a conga line of nervous plush teddies, unspooled thread trailing behind." },
  20: { medium: "gilded papier-mache sculpture", fur: "gold leaf", visual: "adult over-stuffed mafia-don bear, striped bow tie, fat gold ring", scene: "Enthroned in a newspaper papier-mache wingback chair on a bright white set." },
  21: { medium: "war-movie film still", fur: "soot black", visual: "adult hulking soot-blackened commander bear, cavalry hat, open shirt, ladle in his belt", scene: "Standing in a burning field of drifting teddy stuffing, helicopter silhouettes crossing a huge orange sun." },
  30: { visual: "amber honey jar rigged with a hidden spring-loaded bear trap tucked under a lace garter", scene: "Extreme macro shot on a motel nightstand, honey jar lit by a pulsing red exit-sign glow." },
  31: { visual: "one-armed teddy bear stuffed with a switchblade, a fuzzy pink handcuff dangling from its paw", scene: "Extreme macro on a strip-club dressing table, bear lit by flickering hot pink neon glow." },
  32: { visual: "half-spent dynamite stick taped beside a deflated whoopee cushion on a torn teddy's belly", scene: "Low-angle shot of the dynamite in a police evidence bag, lit by a bare swinging bulb overhead." },
  33: { visual: "cracked button eye rewired into a sparking novelty peep-show viewer, wires frayed and smoking", scene: "Dutch-tilt shot on a pawn-shop counter under sickly green fluorescent tubes, sparks arcing off the wires." },
  34: { visual: "stained honeymoon-suite armchair with a garrote wire hidden inside its frayed tassel fringe", scene: "Shot through a cracked motel mirror, the armchair glowing under a flickering red exit-sign light." },
  40: { visual: "cracked-open first-aid kit crammed with cotton batting, threaded needle, and a foil condom packet", scene: "Overhead flash on a chipped hospital tray, kit contents lit by flickering sickly green fluorescent light." },
  41: { visual: "rocks glass of honey whiskey with a lipstick-stained rim and one glinting ice cube", scene: "Extreme macro on green casino felt, whiskey glass glowing under hot pink neon reflections." },
  42: { visual: "cracked glass button eye, veined red and bloodshot, resting in a chipped ashtray", scene: "Extreme macro on a filthy bar-bathroom sink edge, eye lit by one flickering bare bulb." },
  43: { visual: "rusty toolbox spilling open on a bar stool, needle, thread, and cotton stuffing", scene: "Dutch-tilt shot in the grimy alley behind the bar, toolbox lit by a dim red exit-sign glow." },
  44: { visual: "battered bar PA microphone with a flashing red CENSORED bleep-light zip-tied to the stand", scene: "Low angle on a smoke-hazed dive-bar stage, microphone lit by pulsing hot pink neon signage." },
  45: { visual: "pile of empty mini liquor bottles scattered across a spread of dog-eared playing cards", scene: "Overhead flash on a cluttered motel nightstand, bottles and cards lit by sickly green fluorescent glow." },
  46: { visual: "surgical sewing kit beside a stack of fresh cotton stuffing and a torn fabric patch", scene: "Extreme macro on a stainless hospital tray, stuffing and thread lit by one bare swinging bulb." },
  47: { visual: "dusty bottle of top-shelf whiskey pouring into a row of gleaming lipstick-rimmed shot glasses", scene: "Dutch-tilt shot atop a church collection plate, glasses lit by a single harsh camera flash." },
  50: { medium: "gross-out trading-card painting", fur: "garbage grey", visual: "adult pot-bellied bear, banana-peel crown, fish-skeleton backscratcher", scene: "Soaking blissfully in an overflowing dumpster like a hot tub, flies circling and green stink lines rising." },
  51: { medium: "veterinary anatomy plate", fur: "pale tan", visual: "adult scrawny bear with bald stitched patches, cone of shame, scratching with a back leg", scene: "Drawn as a specimen on aged paper with callout lines, a bleach bottle and a comb beside him." },
  52: { medium: "Kodachrome barbecue snapshot", fur: "sunburnt coral", visual: "adult curvy bear, floral sundress, flip-flops, a beer can in each raised paw", scene: "Dancing on a backyard picnic table, ketchup and potato salad tipping, a smoking grill behind her." },
  53: { medium: "fantasy paperback cover painting", fur: "carpet beige", visual: "adult paunchy bear, cardigan, socks and sandals, giant scissors raised like a broadsword", scene: "Standing heroically on a cart overflowing with coupons, coupons whirling in a storm wind." },
  54: { medium: "honey macro photo", fur: "honey gold", visual: "adult fuzzy bear glued starfish-flat to a wall by dripping honey, sheepish grin", scene: "Stuck to amber tiles in thick honey strands while a single bee hovers curiously." },
  55: { medium: "jazz-sleeve blue duotone photo", fur: "ash grey", visual: "adult curvy bear in curlers, ashtray worn as a pillbox hat, long cigarette holder", scene: "Blowing a perfect smoke ring on a scorched mattress in deep blue duotone." },
  56: { medium: "brutalist worm's-eye photo", fur: "charcoal", visual: "adult colossal slab-wide bear, arms crossed, earpiece, tiny clipboard with a blank list", scene: "Filling a steel doorway in raw concrete, looming down at the lens like a monument." },
  57: { medium: "dog-show pageant photo", fur: "cream and tabby orange", visual: "adult blow-dried long-haired bear, winner's sash, first-place rosette", scene: "Coughing a giant hairball onto a satin show cushion beside a judge's clipboard." },
  58: { medium: "cabaret lithograph poster", fur: "plum wine", visual: "adult squat bear, striped prison shirt, beret, wine glass under his nose", scene: "Sniffing his glass like a connoisseur beside a cell toilet bubbling with fermenting grapes." },
  59: { medium: "holographic foil card", fur: "glitter silver", visual: "adult glitter-encrusted bear coughing out a huge glitter cloud, sparkly tears", scene: "Exploding sparkles over tumbling sequin pots and a glue bottle on rainbow holo foil." },
  60: { medium: "tiki travel poster", fur: "sunburnt salmon", visual: "adult bear in a loud Hawaiian shirt, lime slice hat, paper umbrella", scene: "Lounging in a giant salt-rimmed margarita like a hot tub over stylised waves at sunset." },
  61: { medium: "telenovela freeze-frame", fur: "dusty rose", visual: "adult lanky bear in a bridesmaid dress mid-slap, tiny wire mic at her neckline", scene: "Slapping a teddy groom's head sideways as tears and champagne freeze in mid-air." },
  62: { medium: "1950s ad illustration", fur: "tobacco tan", visual: "adult grinning bear in a letterman sweater wrapped in steel chain, ten cigarettes in his mouth", scene: "Beaming like an advert as smoke billows and a deck of cards burns at his feet." },
  63: { medium: "Wild West tintype", fur: "dust brown", visual: "adult wiry bear, cowboy hat, bandana, sheriff's star dangling from her paw", scene: "Flinging bail cash in the air behind a wooden counter, a blank wanted-poster frame behind." },
  64: { medium: "constructivist poster", fur: "olive green", visual: "adult stocky bear in a tunic with medals torn off, lipstick kiss, heart ankle monitor", scene: "Saluting stiffly on bold red and black diagonals." },
  65: { medium: "papercut shadow-box diorama", fur: "gunmetal grey", visual: "adult gaunt bear in a bowler hat, giant rubber mallet, kneecap-shaped plush pillows", scene: "Looming in a paper doorway in ledger green and red, a nervous little red teddy beside him." },
  66: { medium: "symmetrical pastel film still", fur: "caramel", visual: "adult big over-stuffed bear in a floral apron, rolling pin raised overhead, fierce glare", scene: "Dead centre on a pastel kitchen counter behind a lattice pie, cupboards mirrored either side." },
  67: { medium: "Gothic stained glass", fur: "whiskey amber", visual: "adult portly bear in vestments, bottle-cap rosary, whiskey-glass halo", scene: "Pouring whiskey into a golden chalice inside leaded jewel-glass panes." },
  68: { medium: "metal album airbrush", fur: "scorched punk brown", visual: "adult spiked leather jacket, bottle-cap crown, plunger sceptre", scene: "Enthroned on a flaming dumpster under violet lightning, a fire extinguisher discarded." },
  69: { medium: "kaiju B-movie poster", fur: "snow white", visual: "adult gigantic bear with arms wide for a hug, huge metal spoon", scene: "Towering over a night city like a monster, searchlights crossing his chest, tiny teddies fleeing." },
  70: { visual: "glass bowl of gummy bears spiked with a jagged shard beside a torn condom wrapper", scene: "Extreme macro on a filthy bar-bathroom sink ledge, hard camera flash bouncing off the glass shard." },
  71: { visual: "spilled beer and glitter puddle on sticky tile floor, wet-floor sign knocked flat nearby", scene: "Low angle near stacked back-alley crates, puddle lit by one bare swinging bulb overhead." },
  72: { visual: "arcade claw machine loaded with grenades and a snagged bachelorette sash instead of plush toys", scene: "Dutch-tilt shot on a casino floor, claw machine bathed in buzzing hot pink neon light." },
  73: { visual: "row of lipstick-stained shot glasses tipping and shattering off a packed bar rail", scene: "Low-angle shot along the bar top, glasses caught mid-shatter in a blinding camera flash." },
  74: { visual: "rusted mop bucket brimming with honey, bent nails, and a lost bachelor-party necktie", scene: "Dutch-tilt shot beside a back-alley dumpster, bucket contents lit by sickly green fluorescent spill light." },
  75: { visual: "shaggy tuft of bear fur floating in a tall glass of flat morning-after beer", scene: "Extreme macro on a motel nightstand, flat beer glass lit by one bare swinging bulb." },
  76: { visual: "tiny hotel minibar fridge hanging open, rows of miniature liquor bottles drained and toppled", scene: "Low angle inside a motel room, minibar glowing faintly under a red exit-sign light." },
  77: { visual: "cracked phone face-up on wet bar wood, screen lit with a wall of damning texts", scene: "Overhead flash on a police desk, phone bagged as evidence, screen glaring under harsh camera flash." },
  78: { visual: "teddy bear dunked headfirst into an overflowing pitcher of foaming beer, arms flailing", scene: "Shot through a cracked bar mirror, the dunked bear lit by hot pink neon signage." },
  79: { visual: "plate of lumpy green-tinged pot brownies with one bite missing and a rolled receipt", scene: "Extreme macro on a pawn-shop counter, brownies glowing sickly under flickering green fluorescent light." },
  80: { medium: "penny-dreadful mezzotint", fur: "navy blue", visual: "adult sleepy bear, striped nightcap, nightgown, candlestick and whisky glass", scene: "Creeping down a creaky staircase while his candle shadow on the wall throws punches." },
  81: { medium: "Technicolor premiere photo", fur: "wine red", visual: "adult statuesque bear in a gown of coiled velvet rope with brass stanchion buttons", scene: "Blocking the red carpet with one paw up in a firm no as flashbulbs pop." },
  82: { medium: "citrus crate label", fur: "citrus yellow", visual: "adult squat bear with a puckered stitched mouth, lemon and whiskey sour, cherry on his head", scene: "Standing before a sunburst over a lemon orchard." },
  83: { medium: "motel Polaroid", fur: "silver blonde", visual: "adult sly bear shushing with one paw, a hollowed-out book full of cash and a fake passport", scene: "On a 70s motel bedspread by wood panelling, a room key on a plastic fob beside her." },
  84: { medium: "Art Nouveau cabaret poster", fur: "fuzzy pink", visual: "adult chubby winking bear on a velvet chair, feather boa", scene: "Framed in whiplash floral curves as a very long receipt unrolls around her like a ribbon." },
  85: { medium: "architectural blueprint", fur: "teal felt", visual: "adult cheeky bear in a hard hat and toolbelt with a power drill", scene: "Peeking through a round hole he drilled in a plywood wall, drawn as a blueprint with dimension arrows." },
  86: { medium: "fashion editorial photo", fur: "glossy black", visual: "adult sleek bear in a leather corset vest and long gloves, giant red stop-sign paddle", scene: "Calm and in charge against stark black, one eyebrow raised, red gel light on her edge." },
  87: { medium: "disco mirrorball flash photo", fur: "confetti gold", visual: "adult hulking glittery bear hanging off a ceiling fan by his own shirt, legs still dancing", scene: "Spinning under a mirrorball with confetti and streamers frozen in the flash." },
  88: { medium: "Vegas neon photo", fur: "cash green", visual: "adult squat grinning bear in a shiny tux jacket unrolling an endless receipt", scene: "Receipt spilling down a neon casino staircase among scattered chips, a neon star behind him." },
  89: { medium: "mid-century diner realist painting", fur: "amber", visual: "adult tall chunky bear in a sequin party dress, one heel on and one in her paw", scene: "Waddling out of an empty all-night diner at closing, one cup left on the counter." },
  90: { medium: "telephoto safari wildlife photo", fur: "wine red", visual: "adult over-stuffed bear in a leopard-print robe and sunglasses, a younger teddy beside her", scene: "On the prowl on a savannah rock at golden hour, shot through tall grass like big game." },
  91: { medium: "city-pop anime illustration", fur: "dishevelled beige", visual: "adult messy bear in last night's sparkly dress and boa, party hat on, receipt stuck to her foot", scene: "Strutting sheepishly over an empty city zebra crossing at a pastel sunrise." },
  92: { medium: "punk xerox flyer", fur: "punch red", visual: "adult squat bear with a punchbowl belly, spiky mohawk, studded collar, ladle as a mic", scene: "Screaming into his ladle as ice cubes fly, on torn photocopied collage with safety pins." },
  93: { medium: "Belgian surrealist oil", fur: "hangover grey", visual: "adult bleary bear in a bed floating in the sky under his own raincloud", scene: "A giant aspirin hangs like the moon and a bowler hat sits on the bedpost." },
  94: { medium: "Y2K chrome render", fur: "midnight plum", visual: "adult lean bear in a glossy trench coat holding a chrome boot-shaped flip phone", scene: "Tapping her foot impatiently in a chrome doorway among iridescent bubbles." },
  95: { medium: "80s hotel catalogue photo", fur: "linen beige", visual: "adult neat bellhop bear in cap and waistcoat with a silver room-service cart", scene: "Lifting the cloche with a straight face on fluffy pink novelty handcuffs, a towel swan beside." },
  ...QUICKIE_ART,
  ...NIGHT_TWO_ART,
  ...HEN_DO_ART,
  ...LAST_ORDERS_ART,
  ...MORNING_AFTER_ART,
  ...CHUCK_ART,
  ...NAUGHTY_LIST_ART,
};

export default CARD_ART;
