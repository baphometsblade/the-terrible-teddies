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
  21: { medium: "war-movie film still", fur: "mud black", visual: "adult hulking mud-caked commander bear, cavalry hat, camouflage face paint", scene: "Rising out of a misty jungle river at dawn, helicopter silhouettes in the fog." },
  30: { visual: "a plum plush in a silk gown with his paw snapped in a mousetrap baited with a garter-wrapped honey jar", scene: "Extreme close-up on a motel nightstand under a red lampshade glow, honey splattering." },
  31: { visual: "a navy plush frozen mid-hug with cactus spines in his snout from a glamorous plush's cactus boa", scene: "Strip-club dressing table framed by mirror bulbs, hot pink neon, powder puffs and lipsticks." },
  32: { visual: "a novelty bomb cake going off too early in a sneaking tan plush's face, crowbar flying", scene: "Grimy back room under a bare swinging bulb, confetti, cream and soot frozen mid-air." },
  33: { visual: "a cream plush fried by a coin-op love tester, blue-white arcs up his arms, fur frizzed", scene: "Pawn shop counter, guitars on the wall and a watch case behind, smoke curling off his fur." },
  34: { visual: "a steel-grey plush crushed by a red velvet honeymoon armchair that hugs back, seams bursting", scene: "Shot through a cracked motel mirror, red lamp light, stuffing and buttons in the air." },
  40: { visual: "a winking plush nurse pumping stuffing into a cocoa plush's deflated arm with a stuffing gun", scene: "Overhead flash in a mint-tiled back-room clinic, first-aid kit of cotton batting, cash under the pillow." },
  41: { visual: "a leopard-print croupier plush behind a lipstick-rimmed honey whiskey that sits on a playing card coaster", scene: "Close on emerald casino felt in hot pink neon reflections, a knowing wink out of focus." },
  42: { visual: "an ash-grey insomniac plush with one huge bloodshot button eye, paw resting on a small deck of cards", scene: "Dark kitchen at 4 a.m. in amber open-fridge light, coffee cups towering, a ring in a saucer." },
  43: { visual: "a ripped-open charcoal brawler stapled shut on beer crates by a plush surgeon in a welding mask", scene: "Wet back alley under a rotating red light, toolbox of needles and duct tape, cash under the crate." },
  44: { visual: "a brick-red plush coach screaming through a megaphone as four brawlers puff up a size", scene: "Grimy concrete locker room under flickering tubes and a rotating red bleep light." },
  45: { visual: "a cherry-red plush on a trashed motel bed fanning three cards, three empties on his belly", scene: "Overhead on a teal motel bedspread in striped dawn light, pizza boxes and confetti." },
  46: { visual: "a flat caramel plush re-inflated with a hose of cotton by two plush clinicians", scene: "White luxury clinic with blush leather and orchids, cucumber slices and a champagne flute." },
  47: { visual: "a plush priest sprinkling spirits over a row of kneeling brawlers wearing halos", scene: "Small chapel in ruby and sapphire light, a pool table in the aisle, shot glasses on the collection plate." },
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
  62: { medium: "steampunk boiler-room illustration", fur: "tobacco tan", visual: "adult slick bear in a stoker's cap wrapped in iron chain, a lit cigarette in his mouth", scene: "Chain-lighting the next one in a riveted boiler room, smoke venting from his ears like a steam whistle." },
  63: { medium: "Wild West tintype", fur: "dust brown", visual: "adult wiry bear, cowboy hat, bandana, sheriff's star dangling from her paw", scene: "Flinging bail cash in the air behind a wooden counter, a blank wanted-poster frame behind." },
  64: { medium: "constructivist poster", fur: "olive green", visual: "adult stocky bear in a tunic with medals torn off, lipstick kiss, heart ankle monitor", scene: "Saluting stiffly on bold red and black diagonals." },
  65: { medium: "papercut shadow-box diorama", fur: "gunmetal grey", visual: "adult gaunt bear in a bowler hat, giant rubber mallet, kneecap-shaped plush pillows", scene: "Looming in a paper doorway in ledger green and red, a nervous little red teddy beside him." },
  66: { medium: "symmetrical pastel film still", fur: "caramel", visual: "adult big over-stuffed bear in a floral apron, rolling pin raised overhead, fierce glare", scene: "Dead centre on a pastel kitchen counter behind a lattice pie, cupboards mirrored either side." },
  67: { medium: "Gothic stained glass", fur: "whiskey amber", visual: "adult portly bear in vestments, bottle-cap rosary, whiskey-glass halo", scene: "Pouring whiskey into a golden chalice inside leaded jewel-glass panes." },
  68: { medium: "metal album airbrush", fur: "scorched punk brown", visual: "adult spiked leather jacket, bottle-cap crown, plunger sceptre", scene: "Enthroned on a flaming dumpster under violet lightning, a fire extinguisher discarded." },
  69: { medium: "kaiju B-movie poster", fur: "snow white", visual: "adult gigantic bear with arms wide for a hug, huge metal spoon", scene: "Towering over a night city like a monster, searchlights crossing his chest, tiny teddies fleeing." },
  70: { visual: "an orange plush frozen mid-chew on a cracked glass gummy bear", scene: "Hard flash on a white-tiled bathroom sink ledge, a bowl of candy-coloured gummies." },
  71: { visual: "a teal plush going horizontal mid-punch on a glitter-beer puddle", scene: "Floor level in a sticky tiled back corridor, glitter spraying, the wet-floor sign knocked flat." },
  72: { visual: "a ginger plush hoisted by the scruff in a claw machine over bachelorette prizes", scene: "Through the glass of a claw case on a casino floor, glowing hot pink and violet." },
  73: { visual: "a burgundy plush flattened under a stampede of party plushes racing for tequila shots", scene: "Floor-level on a mirror-ball dance floor in magenta and blue strobes, shot glasses flying." },
  74: { visual: "a snow-white plush drenched in honey and feathers with the rigged bucket jammed on his head", scene: "Back-alley stage door by a dumpster under a teal-blue security light, honey dripping." },
  75: { visual: "a balding honey-blond plush drinking beer with his own fur tuft in it as the bald patch regrows", scene: "Motel bed in cool morning light through net curtains, painkillers and a sock on the lampshade." },
  76: { visual: "a wrecked sky-blue plush on the motel carpet with a miniature bottle taped up as a tiny IV drip", scene: "Low flash shot by an open minibar at 3 a.m., drained miniatures toppled, one ear starting to lift." },
  77: { visual: "a mustard plush plugging a cracked phone that gushes four playing cards like a burst water main", scene: "Hard flash on a steel police desk, spray and blank speech-bubble foam frozen mid-air." },
  78: { visual: "a battered lime plush dunked in a beer-pitcher font by a plush preacher, rising fluffed with a foam halo", scene: "Stainless-steel bar top under hot pink neon, foam pouring over the steel, dark tiled wall." },
  79: { visual: "a giggling pistachio plush biting a brownie that slides out two cards like a fortune cookie", scene: "Glass pawn-shop counter in a violet haze, sparkles drifting, a rolled receipt beside the plate." },
  80: { medium: "penny-dreadful mezzotint", fur: "navy blue", visual: "adult sleepy bear, striped nightcap, nightgown, candlestick and whisky glass", scene: "Creeping down a creaky staircase while his candle shadow on the wall throws punches." },
  81: { medium: "Technicolor premiere photo", fur: "wine red", visual: "adult statuesque bear in a gown of coiled velvet rope with brass stanchion buttons", scene: "Blocking the red carpet with one paw up in a firm no as flashbulbs pop." },
  82: { medium: "citrus crate label", fur: "citrus yellow", visual: "adult squat bear with a puckered stitched mouth, lemon and whiskey sour, cherry on his head", scene: "Standing before a sunburst over a lemon orchard." },
  83: { medium: "motel Polaroid", fur: "silver blonde", visual: "adult sly bear shushing with one paw, a hollowed-out book full of cash and a fake passport", scene: "On a 70s motel bedspread by wood panelling, a room key on a plastic fob beside her." },
  84: { medium: "Art Nouveau cabaret poster", fur: "fuzzy pink", visual: "adult chubby winking bear on a velvet chair, feather boa", scene: "Framed in whiplash floral curves as a very long receipt unrolls around her like a ribbon." },
  85: { medium: "architectural blueprint", fur: "teal felt", visual: "adult cheeky bear in a hard hat and toolbelt with a power drill", scene: "Peeking through a round hole he drilled in a plywood wall, drawn as a blueprint with dimension arrows." },
  86: { medium: "fashion editorial photo", fur: "glossy black", visual: "adult sleek bear in a leather corset vest and long gloves, giant red stop-sign paddle", scene: "Calm and in charge against stark black, one eyebrow raised, red gel light on her edge." },
  87: { medium: "disco mirrorball flash photo", fur: "confetti gold", visual: "adult hulking glittery bear hanging off a ceiling fan by his own shirt, legs still dancing", scene: "Spinning under a mirrorball with confetti and streamers frozen in the flash." },
  88: { medium: "Vegas neon photo", fur: "cash green", visual: "adult squat grinning bear in a shiny tux jacket unrolling an endless receipt", scene: "Receipt spilling down a neon casino staircase among scattered chips, a neon star behind him." },
  89: { medium: "GTA loading-screen illustration", fur: "amber", visual: "adult tall chunky bear in a silver sequin party dress on a bar table", scene: "Last call under the house lights, a tray of the last shots and a pink cocktail at her feet." },
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
