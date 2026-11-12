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
  4: { medium: "kung-fu poster painting", fur: "rust red", visual: "adult lanky wiry bear, black eye, missing tooth, flapping sleeveless flannel, bar stool overhead", scene: "Flying kick mid-air through a wrecked pub, splinters, peanuts and beer foam exploding outward." },
  5: { medium: "16mm police film still", fur: "patchwork plum and grey", visual: "adult scrawny patchwork bear, huge cross-stitches, wire mic taped to his chest", scene: "Leaning across a steel interrogation table to whisper behind his paw, two-way mirror behind, one swinging bulb." },
  6: { medium: "expressionist oil painting", fur: "faded pink", visual: "adult lanky bear, smug raised brow, huge stitched mouth, comedy mic", scene: "Mid-insult at the mic while the swirling club bends away and a front row of teddies reels back." },
  7: { medium: "Technicolor binocular still", fur: "moss green", visual: "adult scrawny moth-eaten bear, lace bra worn as a cap, binoculars to his button eyes", scene: "Peeking out of an overflowing laundry hamper, seen through a double-circle binocular vignette." },
  8: { medium: "lucha screenprint poster", fur: "charcoal grey", visual: "adult barrel-chested bear, cauliflower ear, sparkly lucha mask, heart-shaped champion belt", scene: "In the ring giving a smaller teddy a 'hug' that is plainly a sleeper hold, the victim's eyes rolling." },
  9: { medium: "tattoo flash ink drawing", fur: "dirty white", visual: "adult teddy head and paws sewn onto a fat pillow body, toothbrush shiv in the seam, sleepy smile", scene: "Drawn on yellowed flash paper among inked roses, daggers, a swallow and a bedside alarm clock." },
  10: { medium: "ukiyo-e woodblock print", fur: "mustard yellow", visual: "adult hulking bristling bear tearing a stress ball in half, steam curling from his ears like waves", scene: "Kneeling on a cracked tatami mat by a broken meditation cushion, steam crashing round him like woodblock waves." },
  11: { medium: "courtroom pastel sketch", fur: "slate grey", visual: "adult broad one-eyed bear, neck brace, court papers stapled across his chest, tape measure", scene: "Toes exactly on a taped line in court, stretching a tape measure toward the gallery with a wounded look." },
  12: { medium: "bodybuilding magazine photo", fur: "brick red", visual: "adult hulking bear, over-stuffed biceps, stuffing bursting from one arm, sweatband, tiny posing trunks", scene: "Double-biceps flex on a chrome gradient backdrop, seams straining, a giant protein shaker at his feet." },
  13: { medium: "bomber nose-art enamel", fur: "jet black", visual: "adult round singed bomb-shaped bear, lit fuse on his head, mouth open mid-swear", scene: "Riding a falling bomb like a rodeo, painted on a riveted olive fuselage with smoke puffs." },
  14: { medium: "Victorian steel engraving", fur: "raw cotton white", visual: "adult squat smug cotton-boll bear, top hat, pince-nez, roll of rent money", scene: "Counting rent at a rickety desk in a mouldy tenement, a ceiling leak dripping into a bucket, tenants peering in." },
  15: { medium: "banknote intaglio engraving", fur: "dusty plum", visual: "adult lanky shifty sweating bear, slipping fake moustache, receipts in a shredder", scene: "Framed in an ornate banknote oval, feeding receipts into a shredder that spews confetti." },
  16: { medium: "grand-manner oil portrait", fur: "faded ash blonde", visual: "adult moth-eaten aristocrat bear, velvet smoking jacket, lopsided powdered wig, pawn ticket", scene: "Posing proudly before a crumbling country estate, a single lacy garter draped on the balustrade." },
  17: { medium: "embroidered medieval tapestry", fur: "dark auburn", visual: "adult hulking shaggy bear, horned helmet over one eye, drinking horn", scene: "Passed out on the deck of a stitched longship, a gull stealing his snack, embroidered waves below." },
  18: { medium: "hand-tinted antique photo", fur: "gunmetal silver", visual: "adult stooped old bear, walrus moustache, bedpan helmet, teal cardigan of bottle-cap medals", scene: "Telling an outrageous war story in a red armchair, false teeth in a jar and an ear trumpet beside him." },
  19: { medium: "danse-macabre woodcut", fur: "bone pale grey", visual: "adult skeletal-thin hooded reaper bear, giant sewing scissors, pincushion heart", scene: "Leading a conga line of nervous plush teddies, unspooled thread trailing behind." },
  20: { medium: "Byzantine gold mosaic", fur: "oxblood", visual: "adult over-stuffed mafia-don bear, pinstripe waistcoat, carnation, fat gold ring", scene: "Enthroned like a holy icon in a wingback chair, holding out the ring to be kissed and stroking a plush cat." },
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
  50: { fur: "olive green", visual: "squat grimy bear, flies circling his head, trash-bag poncho, banana peel stuck to one paw", scene: "Worm's-eye view from inside a dumpster under a red exit-sign glow, Dumpster Dave crawling out headfirst into the alley." },
  51: { fur: "burnt orange", visual: "scrawny patchy bear, bald mange spots, scabby skin, frayed rope leash, flea collar worn as a bracelet", scene: "Tight profile shot in a back alley under flickering strip light, Mange Marvin scratching furiously against a doorframe." },
  52: { fur: "honey blonde", visual: "squat bear, smeared lipstick, tipsy grin, tank top riding up, dented beer can crushed in one paw", scene: "Handheld shaky cam on the karaoke stage under a spinning disco ball, Two-Beer Tina dancing badly on a table." },
  53: { fur: "dull khaki", visual: "lanky bear, permanent scowl, coupon-stuffed fanny pack, cheap plastic visor, calculator gripped like a weapon", scene: "Extreme close-up on the face in a kebab shop at 3am under sickly green fluorescent light, Carl haggling over a crumpled receipt." },
  54: { fur: "golden amber", visual: "squat bear, fur matted with dried honey, sticky handprints, honey-crusted apron, flies buzzing near his ears", scene: "Wide full-body shot in a kebab shop at 3am under a single bare bulb, Mickey with one paw stuck fast to the counter." },
  55: { fur: "smoky blue-grey", visual: "lanky bear, cigarette dangling from a stitched mouth, plastic hair curlers, threadbare bathrobe, ash smudges everywhere", scene: "Tight profile shot on the karaoke stage under hot pink neon, Ashtray Annie slumped over a barstool, cigarette still lit." },
  56: { fur: "espresso brown", visual: "barrel-chested bear, cauliflower ear, referee-stripe armband, sunglasses at midnight, earpiece coiled like he matters", scene: "Harsh overhead light on a strip-club stage lit by camera flash, Bouncer Bruno blocking the velvet rope with crossed arms." },
  57: { fur: "ginger shaggy", visual: "scrawny bear, hacking cough, cracked pool cue gripped like a spear, fish-bone necklace, mystery hairball in a napkin", scene: "Paparazzi flash over the pool table under a red exit-sign glow, Harriet hacking mid-cough while swinging her pool cue." },
  58: { fur: "wine maroon", visual: "squat bear, crude jailhouse tattoos across his chest, torn prison jumpsuit, bottle-cap necklace, unhinged grin", scene: "Security-camera angle inside a drunk tank under blue-and-red cop lights, Pierre toasting through the bars with a bottle of toilet-wine." },
  59: { fur: "teal glitter-flecked", visual: "tiny runt bear, hood pulled low, sequins scattered everywhere, darting eyes, glitter-stained fingertips", scene: "Fisheye lens on a strip-club stage under a spinning disco ball, Glitter Lungs hiding in the shadow it casts." },
  60: { fur: "turquoise blue", visual: "barrel-chested bear, peeling sunburn patches, foam pool-noodle armor, salt-rimmed margarita glass, novelty straw behind one ear", scene: "Handheld shaky cam amid bachelor-party wreckage at dawn through the blinds, Beargaritaville floating in a kiddie pool of margarita." },
  61: { fur: "dusty rose", visual: "lanky bear, fresh black eye, informant's wire taped under a torn cardigan, paw raised mid-slap", scene: "Over-the-shoulder shot amid bachelor-party wreckage under camera flash, Sue delivering an open-palm slap across the table." },
  62: { fur: "nicotine yellow", visual: "hulking bear, chain wallet swinging, cigarette burns peppering his chest, eyes wild with the shakes", scene: "Dutch tilt in a parking lot under blue-and-red cop lights, Chad lighting a cigarette off a burning card table." },
  63: { fur: "rich plum", visual: "broad bear, gold tooth glinting, oversized fur coat, phone clamped to one ear, other paw braced protectively", scene: "Paparazzi flash catches Bonnie on the casino floor as dawn light leaks through the blinds, stuffing cash into her garter mid-phone-call." },
  64: { fur: "olive drab", visual: "hulking bear, ripped-off medal patches, dented trash-can-lid shield, ankle monitor blinking under torn fatigues", scene: "Harsh overhead light in a courtroom at dawn through the blinds, Sgt. Snuggles standing rigid at attention in the dock." },
  65: { fur: "smoke black", visual: "lanky bear, cracked plastic nose, tire iron on one shoulder, debt clipboard, brass knuckles as a keychain", scene: "Worm's-eye view of a hospital corridor under moonlight through a broken window, The Debt Collector kicking open a door." },
  66: { fur: "caramel blonde", visual: "over-stuffed bear, claw marks across her muzzle, blood-stained floral apron, tiny teeth necklace, rolling pin in her apron pocket", scene: "Fisheye lens in a kebab shop at 3am under flickering strip light, Mama Mauls roaring over an upturned table." },
  67: { fur: "dove grey", visual: "broad bear, glassy eyes, torn priest collar, whiskey flask tucked in his cassock, rosary made of bottle caps", scene: "Reflection in a church-pew puddle under moonlight through broken stained glass, Whiskey Priest giving last rites over a passed-out drunk." },
  68: { fur: "charred black", visual: "hulking bear, singed crown of bottle caps, tattered fur-trimmed cape, lit matchbook, gasoline can labeled party favors", scene: "Fisheye lens in a back alley lit by camera flash, The Duke of Dumpsterfire torching a trash can with a lit matchbook." },
  69: { fur: "battleship grey", visual: "hulking over-stuffed bear, chest scars, spiked collar, ankle monitor, hospital gown flapping open in back", scene: "Security-camera angle in a hospital room under flickering strip lights, Big Spoon pinning a rival in a suffocating bear hug." },
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
  80: { fur: "stale ale brown", visual: "scrawny bear, undone bow tie, one shoe missing, motel keycard between his teeth", scene: "Low angle in a motel hallway under a red exit sign, Ned toasting a minibar bottle." },
  81: { fur: "burgundy plush", visual: "tall bear in a backless black dress, velvet rope in one paw, unimpressed stare", scene: "Medium shot at a strip-club rope under hot pink neon, Vicky blocking the velvet line." },
  82: { fur: "citrus yellow", visual: "squat bear, puckered scowl, salt on his snout, crushed whiskey glass in one paw", scene: "Tight profile at the bar under amber jukebox light, Walt slamming an empty sour glass." },
  83: { fur: "parchment cream", visual: "lanky bear in a rumpled slip, hollowed motel bible, lipstick on the pages", scene: "Over-the-shoulder shot on a motel bed under one bare bulb, Mara hiding cash in the bible." },
  84: { fur: "stage pink", visual: "curvy bear, sequin bra top, garter of dollar bills, bored professional smile", scene: "Low hero angle on a strip-club stage under a spinning disco ball, Lila mid-spin on a pole." },
  85: { fur: "smoke grey", visual: "lean bear, trench coat, sunglasses indoors, one paw pressed to a plywood glory wall", scene: "Dutch tilt in a dive-bar back room under a red bulb, Gus leaning through a crude partition." },
  86: { fur: "latex black", visual: "broad bear, rubber collar, brass whistle, calm open palm held up like a stop", scene: "Wide shot in a private booth under warm practical light, Sandy calling a halt with one paw." },
  87: { fur: "confetti gold", visual: "hulking bear, shirt snagged on a ceiling fan, glitter in his chest fur, wild grin", scene: "Fisheye lens in a wrecked hotel suite at dawn, Andre dancing on a coffee table." },
  88: { fur: "cash green", visual: "squat bear, open shirt, gold tooth, thick receipt roll used as a sash", scene: "Handheld shot on casino felt under pink neon, Omar buying a round with someone else's card." },
  89: { fur: "last-call amber", visual: "tall bear, smeared mascara, one heel in her paw, dress strap fallen", scene: "Shot through the bar door at closing under harsh house lights, Lana walking out anyway." },
  90: { fur: "wine red", visual: "mature broad bear, silk robe, cigarette holder, paw hooked in a date's loosened tie", scene: "Medium shot in a piano-bar booth under low amber light, Carol choosing the next round." },
  91: { fur: "walk-of-shame beige", visual: "disheveled bear, one heel in her paw, dress strap down, taxi receipt stuck to her thigh", scene: "Low angle by the bar exit under a flickering exit sign, she limping out at dawn." },
  92: { fur: "punch red", visual: "squat bear, cherry stem behind one ear, stained tuxedo shirt, bowl of spiked punch in both paws", scene: "Wide shot at a banquet table under sickly fluorescent light, him toasting too hard." },
  93: { fur: "hangover grey", visual: "bleary bear, sunglasses indoors, aspirin bottle, phone lighting a guilty face", scene: "Overhead shot on a motel bed at dawn, the bear texting with one eye shut." },
  94: { fur: "midnight plum", visual: "lean bear in a trench coat over nothing decent, phone in one paw, impatient grin", scene: "Doorway shot in a motel corridor under a red bulb, her knocking at 2am." },
  95: { fur: "linen white", visual: "neat bear in a waistcoat, ice bucket, folded towel, knowing butler smile", scene: "Dutch tilt in a hotel corridor under warm sconce light, the tray held at a shut door." },
  ...QUICKIE_ART,
  ...NIGHT_TWO_ART,
  ...HEN_DO_ART,
  ...LAST_ORDERS_ART,
  ...MORNING_AFTER_ART,
  ...CHUCK_ART,
  ...NAUGHTY_LIST_ART,
};

export default CARD_ART;
