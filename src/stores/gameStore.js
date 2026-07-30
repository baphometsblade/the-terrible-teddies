import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shuffleDeck } from '@/utils/deckUtils';
import { getCurrentSeason } from '@/utils/season';

export const ALL_CARDS = [
  // Common (Starter Cards)
  { id: 1, name: "Shitstarter Ted", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common', visual: "barrel-chested chocolate-brown bear, torn ear, leather biker vest, brass knuckles on one paw", description: "Every bar fight in this town starts with Ted." },
  { id: 2, name: "Feral Tim", attack: 1, defense: 1, type: 'action', cost: 1, ability: 'swarm', rarity: 'common', visual: "tiny runt raccoon-grey bear, dirt-matted fur, feral claw scratches, ragged fingerless gloves", description: "Raised by raccoons. It shows." },
  { id: 3, name: "Fluffy McFuckface", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common', visual: "squat and fat cream-white bear, chubby cheeks, mismatched button eyes, stained bowling shirt", description: "Legally changed his name. Won the bet." },
  { id: 4, name: "Bar-Fight Barry", attack: 2, defense: 1, type: 'action', cost: 1, ability: 'none', rarity: 'common', visual: "lanky rust-red bear, black eye, missing teeth, sleeveless torn flannel shirt", description: "Banned from six pubs and one build-a-workshop." },
  { id: 5, name: "Stitches the Snitch", attack: 1, defense: 3, type: 'action', cost: 2, ability: 'none', rarity: 'common', visual: "scrawny patchwork two-tone bear, stitched muzzle scar, cracked glasses, snitch's clipboard tucked under one arm", description: "Held together by thread and plea deals." },

  // Uncommon
  { id: 6, name: "Shit-Talk Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt', rarity: 'uncommon', visual: "lanky faded-pink bear, permanent snarl, gold hoop earrings, popped-collar leather jacket, finger jabbing forward", description: "Runs her mouth until you HAVE to hit her. That's the plan." },
  { id: 7, name: "Peeping Pete", attack: 3, defense: 1, type: 'action', cost: 2, ability: 'stealth', rarity: 'uncommon', visual: "scrawny moth-eaten-beige bear, one eye peering out, trench coat collar turned up, binoculars around neck", description: "You can't target what's hiding in your hamper." },
  { id: 8, name: "Chokehold Cuddles", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'shield', rarity: 'uncommon', visual: "barrel-chested charcoal-grey bear, cauliflower ear, duct-taped cardboard breastplate, wrestling singlet straps", description: "His hugs are technically a submission move." },
  { id: 9, name: "Shiv-in-a-Pillow", attack: 4, defense: 1, type: 'action', cost: 3, ability: 'piercing', rarity: 'uncommon', visual: "squat dirty-white bear, cracked plastic nose, torn pillowcase seam, rusty shiv gripped in one paw", description: "Soft on the outside. Very much not on the inside." },
  { id: 10, name: "Anger-Management Gus", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'fury', rarity: 'uncommon', visual: "hulking mustard-yellow bear, bloodshot eyes, torn straightjacket sleeves, crumpled therapy pamphlet in one paw", description: "Dropped out of the program. The program was relieved." },

  // Rare
  { id: 11, name: "Restraining-Order Randy", attack: 1, defense: 5, type: 'action', cost: 3, ability: 'protect', rarity: 'rare', visual: "broad slate-grey bear, one eye missing, neck brace, court papers stapled across his chest, arms braced wide", description: "You legally cannot get within 50 feet of his friends." },
  { id: 12, name: "'Roid-Rage Reggie", attack: 2, defense: 3, type: 'action', cost: 3, ability: 'fury', rarity: 'rare', visual: "hulking tan bear, veins bulging under matted fur, ripped gym cut-off shirt, chalk-dusted paws", description: "The stuffing is 90% pre-workout." },
  { id: 13, name: "The F-Bomb", attack: 5, defense: 0, type: 'action', cost: 4, ability: 'none', rarity: 'rare', visual: "scrawny jet-black bear with singed fur, wild eyes, bandolier of tiny liquor bottles", description: "Drops hard. Offends everyone. No survivors." },
  { id: 14, name: "Slumlord Cotton", attack: 3, defense: 3, type: 'action', cost: 4, ability: 'royal', rarity: 'rare', visual: "squat oatmeal-colored bear, smug expression, ill-fitting tiny business suit, gold rings, jangling key ring at belt", description: "Owns half the toy chest. Fixes none of it." },
  { id: 15, name: "Tax-Fraud Teddy", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'stealth', rarity: 'rare', visual: "lanky taupe bear, shifty sidelong glance, briefcase handcuffed to one wrist, sunglasses indoors, loosened tie", description: "Officially, he doesn't exist. Ask his accountant." },

  // Epic
  { id: 16, name: "Lord Fluffington, Disgraced", attack: 4, defense: 4, type: 'action', cost: 5, ability: 'shield', rarity: 'epic', visual: "hulking ash-blonde bear, cracked monocle, dented armor breastplate under a torn velvet fur coat, broken tiara", description: "Lost the estate. Kept the attitude and the armor." },
  { id: 17, name: "Blackout Bjorn", attack: 6, defense: 1, type: 'action', cost: 4, ability: 'fury', rarity: 'epic', visual: "hulking dark-auburn bear, glazed unfocused eyes, shredded Hawaiian shirt, empty liquor bottles strung as a necklace", description: "Remembers nothing. Regrets everything. Hits like a truck." },
  { id: 18, name: "Grandpa Warcrimes", attack: 2, defense: 6, type: 'action', cost: 5, ability: 'protect', rarity: 'epic', visual: "broad silver-white bear, bandaged head, tattered army surplus jacket heavy with medals, one paw raised to shield", description: "Don't ask what he did in the Pillow Wars. He'll tell you." },
  { id: 19, name: "The Seam Reaper", attack: 5, defense: 3, type: 'action', cost: 5, ability: 'piercing', rarity: 'epic', visual: "lanky ash-grey bear, stitched-shut eye, tattered black hooded robe, rusty sewing-scissors scythe raised high", description: "Comes for every bear's thread eventually." },

  // Legendary
  { id: 20, name: "The Godfluffer", attack: 5, defense: 5, type: 'action', cost: 6, ability: 'taunt', rarity: 'legendary', visual: "over-stuffed oxblood-brown bear, gold chains, pinstripe suit straining at the seams, fat cigar in his teeth", description: "He'll make you an offer you can't refuse. Or ignore." },
  { id: 21, name: "Fluffpocalypse Now", attack: 7, defense: 3, type: 'action', cost: 6, ability: 'fury', rarity: 'legendary', visual: "hulking soot-blackened bear, cracked aviator sunglasses, bandolier of grenades, camo headband, fur still smoking", description: "Loves the smell of stuffing in the morning." },

  // Trap Cards
  { id: 30, name: "Honey Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3, rarity: 'common', visual: "amber honey jar rigged with a hidden bear-trap spring under the lid", description: "Sweet, seductive, and absolutely a setup." },
  { id: 31, name: "Hug With Consequences", attack: 0, defense: 0, type: 'trap', cost: 1, effect: 'damage', amount: 2, rarity: 'common', visual: "plush teddy bear rigged with hidden scissor blades sewn behind its arms", description: "It felt nice for exactly one second." },
  { id: 32, name: "Premature Detonation", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, rarity: 'uncommon', visual: "lit stick of dynamite duct-taped to a torn teddy bear's stuffed belly", description: "It happens to lots of traps. Don't make it weird." },
  { id: 33, name: "Full Metal Buttons", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3, rarity: 'uncommon', visual: "cracked tin button eye wired to sparking exposed circuitry and frayed wire", description: "What is your major malfunction, fluffball?" },
  { id: 34, name: "Cuddle Homicide", attack: 0, defense: 0, type: 'trap', cost: 4, effect: 'damage', amount: 6, rarity: 'rare', visual: "worn velvet armchair with a thin garrote wire strung across the cushions", description: "The coroner ruled it 'death by affection.'" },

  // Special Cards
  { id: 40, name: "Emergency Fluff Job", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5, rarity: 'common', visual: "open first-aid kit stuffed with cotton batting and a threaded sewing needle", description: "Quick, discreet, cash only." },
  { id: 41, name: "Honey on the Rocks", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 2, rarity: 'common', visual: "rocks glass of honey-colored whiskey with a single glinting ice cube", description: "Bartender knows the order. Draw two, tell no one." },
  { id: 42, name: "Bloodshot Button Eyes", attack: 0, defense: 0, type: 'special', cost: 1, effect: 'draw', amount: 1, rarity: 'common', visual: "cracked glass button eye, veined red and bloodshot, resting on the bar", description: "Haven't slept since the divorce. See everything." },
  { id: 43, name: "Back-Alley Surgery", attack: 0, defense: 0, type: 'special', cost: 4, effect: 'heal', amount: 8, rarity: 'uncommon', visual: "rusty toolbox open on a bar stool, needle, thread and cotton stuffing spilling out", description: "No license, no anesthesia, no questions." },
  { id: 44, name: "Profanity Pep Talk", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'buff', amount: 1, rarity: 'uncommon', visual: "battered bar PA microphone with a flashing red CENSORED bleep-light clipped on", description: "Every third word is bleeped. All teddies +1 attack." },
  { id: 45, name: "Fluffing Bender", attack: 0, defense: 0, type: 'special', cost: 4, effect: 'draw', amount: 3, rarity: 'rare', visual: "pile of empty mini liquor bottles and scattered playing cards on the bar", description: "Three cards deep and still going. Tomorrow's problem." },
  { id: 46, name: "The Full Refluff", attack: 0, defense: 0, type: 'special', cost: 6, effect: 'heal', amount: 15, rarity: 'epic', visual: "surgical sewing kit and stack of fresh white cotton stuffing beside a torn patch", description: "Head-to-toe restuffing. You didn't hear about the clinic from us." },
  { id: 47, name: "Last Call Blessing", attack: 0, defense: 0, type: 'special', cost: 5, effect: 'buff', amount: 2, rarity: 'legendary', visual: "dusty bottle of top-shelf whiskey poured into a row of gleaming shot glasses", description: "One more round for everybody. All teddies +2 attack." },

  // ——— The Barfly Expansion ———
  // Twenty new bears (ids 50-69). Abilities are restricted to the ones the
  // engine actually implements (taunt/protect/stealth targeting; shield/
  // piercing/fury combat) — see cardSchema.test.js, which enforces this.
  { id: 50, name: "Dumpster Dave", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common', visual: "squat grimy olive-green bear, flies circling his head, trash-bag poncho, banana peel stuck to one paw", description: "Lives behind the bar. Smells like decisions." },
  { id: 51, name: "Mange Marvin", attack: 3, defense: 1, type: 'action', cost: 2, ability: 'none', rarity: 'common', visual: "scrawny patchy orange-tan bear, bald mange spots, scabby skin, frayed rope leash dragging behind him", description: "The bald patches are from stress. And mange." },
  { id: 52, name: "Two-Beer Tina", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common', visual: "squat honey-blonde bear, smeared lipstick, tipsy grin, tank top, dented beer can crushed in one paw", description: "Two beers in and she's everyone's problem." },
  { id: 53, name: "Coupon Carl", attack: 1, defense: 2, type: 'action', cost: 1, ability: 'none', rarity: 'common', visual: "lanky dull-khaki bear, permanent scowl, coupon-stuffed fanny pack, cheap plastic visor, calculator gripped in paw", description: "Fights dirty. Tips worse." },
  { id: 54, name: "Sticky Mickey", attack: 1, defense: 3, type: 'action', cost: 2, ability: 'none', rarity: 'common', visual: "squat syrup-amber bear, fur matted with dried honey, sticky handprints, honey-crusted apron, flies buzzing near ears", description: "Nobody asks why he's sticky. Nobody wants to know." },
  { id: 55, name: "Ashtray Annie", attack: 2, defense: 1, type: 'action', cost: 1, ability: 'none', rarity: 'common', visual: "lanky dingy-tan bear, cigarette dangling from a stitched mouth, plastic hair curlers, threadbare bathrobe, ash smudges", description: "Smells like 1987 and menthols." },
  { id: 56, name: "Bouncer Bruno", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'taunt', rarity: 'uncommon', visual: "barrel-chested espresso-brown bear, cauliflower ear, referee-stripe armband, arms crossed, chest puffed out", description: "You're not on the list. Nobody is on the list." },
  { id: 57, name: "Hairball Harriet", attack: 3, defense: 2, type: 'action', cost: 3, ability: 'piercing', rarity: 'uncommon', visual: "scrawny ginger shaggy bear, hacking cough, cracked pool cue gripped like a spear, fish-bone necklace", description: "Coughs up more than hairballs." },
  { id: 58, name: "Prison-Wine Pierre", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'fury', rarity: 'uncommon', visual: "squat faded-orange bear, crude jailhouse tattoos across his chest, torn prison jumpsuit, bottle-cap necklace, unhinged grin", description: "Ferments grudges in a toilet. Delicious." },
  { id: 59, name: "Glitter Lungs", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'stealth', rarity: 'uncommon', visual: "tiny runt teal-glitter-flecked bear, hood pulled low concealing his face, sequins scattered through patchy fur, darting eyes", description: "Inhaled a craft store in '09. Still sparkles when he coughs." },
  { id: 60, name: "Beargaritaville", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'shield', rarity: 'uncommon', visual: "barrel-chested sandy-tan bear, peeling sunburn patches, foam pool-noodle armor strapped to his chest, salt-rimmed margarita glass", description: "Wastes away. Aggressively." },
  { id: 61, name: "Snitchslap Sue", attack: 3, defense: 3, type: 'action', cost: 3, ability: 'none', rarity: 'uncommon', visual: "lanky dusty-rose bear, fresh black eye, informant's wire taped under a torn cardigan, paw raised to slap", description: "Court-ordered to stay 50 feet from Stitches." },
  { id: 62, name: "Chainsmoke Chad", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'fury', rarity: 'rare', visual: "hulking nicotine-yellowed bear, chain wallet swinging, cigarette burns peppering his chest, eyes wild with the shakes", description: "Lights the next one off your burning deck." },
  { id: 63, name: "Bail-Money Bonnie", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'protect', rarity: 'rare', visual: "broad burnt-sienna bear, gold tooth glinting, oversized fur coat, phone clamped to one ear, other arm braced protectively", description: "She knows a guy. She IS the guy." },
  { id: 64, name: "Sgt. Snuggles, Dishonorable", attack: 4, defense: 3, type: 'action', cost: 4, ability: 'shield', rarity: 'rare', visual: "hulking olive-drab bear, ripped-off medal patches, dented trash-can-lid shield strapped to one arm, stitched permanent scowl", description: "Discharged for conduct unbearable." },
  { id: 65, name: "The Debt Collector", attack: 5, defense: 1, type: 'action', cost: 4, ability: 'piercing', rarity: 'rare', visual: "lanky dark walnut-brown bear, cracked plastic nose, tire iron resting on one shoulder, debt clipboard tucked under arm", description: "Your kneecaps called. They're nervous." },
  { id: 66, name: "Mama Mauls", attack: 5, defense: 3, type: 'action', cost: 5, ability: 'taunt', rarity: 'epic', visual: "over-stuffed cinnamon-brown bear, claw marks across her muzzle, blood-stained floral apron, tiny teeth necklace, chest puffed out snarling", description: "Ask about her cubs. Go ahead. Ask." },
  { id: 67, name: "Whiskey Priest", attack: 3, defense: 5, type: 'action', cost: 5, ability: 'protect', rarity: 'epic', visual: "broad dove-grey bear, glassy eyes, torn priest collar, whiskey flask in his cassock, arm raised in blessing", description: "Absolves everything but his own tab." },
  { id: 68, name: "Duke of Dumpsterfire", attack: 6, defense: 2, type: 'action', cost: 5, ability: 'fury', rarity: 'epic', visual: "hulking charred-orange bear, singed crown of bottle caps, tattered fur-trimmed cape, lit matchbook flaring in one paw", description: "Royalty of the alley. Arsonist of the heart." },
  { id: 69, name: "Big Spoon, Last Warning", attack: 6, defense: 4, type: 'action', cost: 6, ability: 'shield', rarity: 'legendary', visual: "hulking over-stuffed grey bear, chest scars, spiked collar, arms spread wide", description: "The cuddle is mandatory. The survival is optional." },

  // Five new traps (ids 70-74) and five new specials (ids 75-79). Specials
  // only use effects applySpecialEffect implements: heal / draw / buff.
  { id: 70, name: "Glass in the Gummy Bears", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3, rarity: 'common', visual: "glass bowl of gummy bears with a jagged glass shard glinting among them", description: "Chewy, with consequences." },
  { id: 71, name: "Wet Floor, No Sign", attack: 0, defense: 0, type: 'trap', cost: 1, effect: 'damage', amount: 2, rarity: 'common', visual: "spilled beer puddle on tile floor with a cracked wet-floor sign knocked over", description: "OSHA has entered the chat. And slipped." },
  { id: 72, name: "Loaded Claw Machine", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, rarity: 'uncommon', visual: "arcade claw machine packed with grenades instead of the usual plush toys", description: "Rigged? Obviously. Deadly? Also yes." },
  { id: 73, name: "Last Call Stampede", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, rarity: 'uncommon', visual: "row of shot glasses tipping and shattering off a crowded bar rail", description: "Four words: two-for-one tequila night." },
  { id: 74, name: "The Ol' Honey Bucket", attack: 0, defense: 0, type: 'trap', cost: 4, effect: 'damage', amount: 6, rarity: 'rare', visual: "rusty metal bucket overflowing with thick honey and bent rusted nails", description: "Classic. Disgusting. Effective." },
  { id: 75, name: "Hair of the Bear", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'heal', amount: 3, rarity: 'common', visual: "shaggy tuft of bear fur floating in a glass of dark morning-after beer", description: "Cures what the bar did. Causes what the bar will." },
  { id: 76, name: "Minibar Raid", attack: 0, defense: 0, type: 'special', cost: 1, effect: 'heal', amount: 2, rarity: 'common', visual: "tiny hotel minibar fridge door open, rows of miniature liquor bottles emptied out", description: "Tiny bottles. Tiny crimes. Tiny recovery." },
  { id: 77, name: "The Group Chat Leaks", attack: 0, defense: 0, type: 'special', cost: 5, effect: 'draw', amount: 4, rarity: 'rare', visual: "cracked phone face-up on wet bar wood, screen full of damning messages", description: "Everyone's secrets, face up. Draw four, lose friends." },
  { id: 78, name: "Bar-Top Baptism", attack: 0, defense: 0, type: 'special', cost: 5, effect: 'heal', amount: 10, rarity: 'rare', visual: "teddy bear dunked headfirst into an overflowing pitcher of foaming beer", description: "Fully submerged in the good stuff. Born again, smells worse." },
  { id: 79, name: "Suspicious Brownies", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'draw', amount: 2, rarity: 'uncommon', visual: "plate of lumpy pot brownies with a suspicious green tinge, one bite missing", description: "Don't ask what's in them. Draw two, feel weird later." },
];

export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first battle', reward: 100, icon: '🏆' },
  { id: 'win_10', name: 'Rising Champion', description: 'Win 10 battles', reward: 500, icon: '⭐' },
  { id: 'win_50', name: 'Teddy Master', description: 'Win 50 battles', reward: 2000, icon: '👑' },
  { id: 'win_streak_5', name: 'On Fire', description: 'Win 5 battles in a row', reward: 300, icon: '🔥' },
  { id: 'collect_20', name: 'Collector', description: 'Collect 20 unique cards', reward: 400, icon: '📚' },
  { id: 'collect_40', name: 'Hoarder', description: 'Collect 40 unique cards', reward: 1000, icon: '🗃️' },
  { id: 'collect_55', name: 'Problem Collector', description: 'Collect 55 unique cards', reward: 2500, icon: '🏚️' },
  { id: 'collect_all', name: 'Complete Collection', description: 'Collect all cards', reward: 10000, icon: '💎' },
  { id: 'play_100', name: 'Dedicated Player', description: 'Play 100 battles', reward: 1000, icon: '🎮' },
  { id: 'deal_1000_damage', name: 'Damage Dealer', description: 'Deal 1000 total damage', reward: 500, icon: '💥' },
  { id: 'heal_500', name: 'Medic Bear', description: 'Heal 500 total HP', reward: 300, icon: '💚' },
  { id: 'perfect_win', name: 'Flawless', description: 'Win without losing HP', reward: 1000, icon: '💫' },
  { id: 'comeback', name: 'Comeback King', description: 'Win with 5 or less HP', reward: 500, icon: '👊' },
  { id: 'level_10', name: 'Leveling Up', description: 'Reach level 10', reward: 500, icon: '📈' },
  { id: 'level_25', name: 'Veteran', description: 'Reach level 25', reward: 1500, icon: '🎖️' },
  { id: 'daily_7', name: 'Weekly Warrior', description: 'Log in 7 days in a row', reward: 700, icon: '📅' },
];

export const DAILY_REWARDS = [
  { day: 1, coins: 50, gems: 0, cards: 0, packs: 0 },
  { day: 2, coins: 75, gems: 0, cards: 1, packs: 0 },
  { day: 3, coins: 100, gems: 5, cards: 0, packs: 0 },
  { day: 4, coins: 100, gems: 0, cards: 2, packs: 0 },
  { day: 5, coins: 150, gems: 0, cards: 0, packs: 1 },
  { day: 6, coins: 200, gems: 10, cards: 3, packs: 0 },
  { day: 7, coins: 300, gems: 25, cards: 0, packs: 2 },
];

export const SHOP_ITEMS = [
  { id: 'pack_1', name: 'Card Pack', description: '5 random cards', icon: '📦', price: 200, currency: 'coins', type: 'pack', quantity: 1 },
  { id: 'pack_5', name: '5 Card Packs', description: '25 random cards (10% off)', icon: '📦', price: 900, currency: 'coins', type: 'pack', quantity: 5 },
  { id: 'pack_10', name: '10 Card Packs', description: '50 random cards (20% off)', icon: '📦📦', price: 1600, currency: 'coins', type: 'pack', quantity: 10 },
  { id: 'premium_pack', name: 'Premium Pack', description: 'Guaranteed rare or better!', icon: '💎', price: 50, currency: 'gems', type: 'premium', quantity: 1 },
  { id: 'legendary_pack', name: 'Legendary Pack', description: '10 cards, guaranteed legendary!', icon: '⭐', price: 200, currency: 'gems', type: 'legendary', quantity: 1 },
  { id: 'coins_small', name: 'Small Coin Bag', description: '+500 coins', icon: '💰', price: 10, currency: 'gems', type: 'coins', quantity: 500 },
  { id: 'coins_large', name: 'Large Coin Bag', description: '+3000 coins', icon: '💰', price: 50, currency: 'gems', type: 'coins', quantity: 3000 },
];

const getXPForLevel = (level) => Math.floor(100 * Math.pow(1.5, level - 1));

// Coins refunded when a card pull duplicates one you already own, so paid packs
// always have value even for near-complete collections.
const DUPLICATE_COIN_VALUE = { common: 10, uncommon: 20, rare: 40, epic: 75, legendary: 150 };
const coinsForDuplicate = (cardId) => {
  const card = ALL_CARDS.find(c => c.id === cardId);
  return DUPLICATE_COIN_VALUE[card?.rarity] ?? 10;
};

// Returns the Monday of the current week as a date string for weekly reset keys
const getWeekKey = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).toDateString();
};

const initialState = {
  playerName: 'Fresh Meat',
  level: 1,
  xp: 0,
  // Monotonic lifetime XP that never decreases on level-up — drives the Battle
  // Pass tiers, which need cumulative progress (unlike `xp`, which resets each
  // level).
  seasonXP: 0,
  // High-water mark of the authoritative (purchased) gem total we've already
  // credited locally. Login/purchase only credits the positive delta above this
  // mark, so spent gems are never restored by re-reading the server balance.
  lastSyncedServerGems: 0,
  coins: 500,
  gems: 10,
  ownedCards: [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42],
  currentDeck: [1, 2, 3, 4, 5, 6, 30, 40, 41, 42],
  savedDecks: [],
  // All-time stats
  totalWins: 0,
  totalLosses: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  totalDamageDealt: 0,
  totalHealingDone: 0,
  totalBattles: 0,
  // Daily challenge stats (reset each calendar day)
  todayWins: 0,
  todayBattles: 0,
  todayDamageDealt: 0,
  todayCardsPlayed: 0,
  dailyStatsDate: null,
  // Weekly challenge stats (reset each Monday)
  weekWins: 0,
  weekCoinsEarned: 0,
  weekBestStreak: 0,
  weekNewCards: 0,
  weeklyStatsDate: null,
  // Claimed challenge IDs (persisted so players can't double-claim)
  claimedChallenges: [],
  // System
  completedAchievements: [],
  lastLoginDate: null,
  consecutiveLogins: 0,
  cardPacks: 1,
  premiumPacks: 0,
  legendaryPacks: 0,
  soundEnabled: true,
  musicEnabled: true,
  animationsEnabled: true,
  // New players start on 'easy' for a gentler first session (the AI is a real
  // threat under the creature-HP combat model); they can ramp up in Settings.
  // Only affects fresh saves — returning players keep their persisted choice.
  difficulty: 'easy',
  tutorialCompleted: false,
  // Battle Pass
  hasBattlePassPremium: false,
  claimedBattlePassRewards: { free: [], premium: [] },
  // Which season the pass progress belongs to; null until first stamped.
  // When the rolling season advances past this, syncSeason() resets the pass.
  seasonKey: null,
};

export const useGameStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // Not persisted — populated only in the current session
      pendingAchievements: [],

      setPlayerName: (name) => set({ playerName: name }),

      addXP: (amount) => {
        // Roll the Battle Pass season first so this XP lands in the correct
        // season's progress (get() below must see the post-rollover state).
        get().syncSeason();
        const state = get();
        let newXP = state.xp + amount;
        let newLevel = state.level;
        let bonusCoins = 0;

        while (newXP >= getXPForLevel(newLevel)) {
          newXP -= getXPForLevel(newLevel);
          newLevel++;
          bonusCoins += 100 * newLevel;
        }

        set({
          xp: newXP,
          level: newLevel,
          seasonXP: state.seasonXP + amount,
          coins: state.coins + bonusCoins,
        });
        get().checkAchievement('level_10', newLevel >= 10);
        get().checkAchievement('level_25', newLevel >= 25);
      },

      getXPForNextLevel: () => getXPForLevel(get().level),

      addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
      spendCoins: (amount) => {
        const state = get();
        if (state.coins >= amount) {
          set({ coins: state.coins - amount });
          return true;
        }
        return false;
      },

      addGems: (amount) => set((state) => ({ gems: state.gems + Math.max(0, amount) })),
      setGems: (amount) => set({ gems: amount }),

      // Credit only newly-purchased gems (the amount the authoritative server
      // balance has risen since we last synced), then advance the high-water
      // mark. Re-reading the server balance after spending therefore can't
      // restore spent gems, while purchases made on another device still land.
      reconcileServerGems: (serverBalance) => {
        if (typeof serverBalance !== 'number' || Number.isNaN(serverBalance)) return;
        const state = get();
        const delta = serverBalance - state.lastSyncedServerGems;
        if (delta > 0) {
          set({ gems: state.gems + delta, lastSyncedServerGems: serverBalance });
        } else if (delta < 0) {
          // Server total moved down (shouldn't happen) — just track it, never
          // remove gems the player already earned/spent locally.
          set({ lastSyncedServerGems: serverBalance });
        }
      },
      spendGems: (amount) => {
        const state = get();
        if (state.gems >= amount) {
          set({ gems: state.gems - amount });
          return true;
        }
        return false;
      },

      // Roll the Battle Pass over when the calendar season has advanced:
      // progress, claims, and premium are per-season.
      syncSeason: () => {
        const { key } = getCurrentSeason();
        const state = get();
        if (state.seasonKey === key) return;
        if (state.seasonKey === null) {
          // Un-stamped save (fresh player or pre-rollover release). Any
          // existing pass progress was earned under the ORIGINAL hardcoded
          // Season 1 — it may only be grandfathered while Season 1 is still
          // the current season. Once the calendar is past it, stamping
          // without a reset would attach legacy progress (tiers, claims,
          // premium) to the new season.
          const hasLegacyProgress =
            state.seasonXP > 0 ||
            state.hasBattlePassPremium ||
            state.claimedBattlePassRewards.free.length > 0 ||
            state.claimedBattlePassRewards.premium.length > 0;
          if (key === 'season-1' || !hasLegacyProgress) {
            set({ seasonKey: key });
            return;
          }
          // fall through: legacy Season-1 progress in a later season → reset
        }
        set({
          seasonKey: key,
          seasonXP: 0,
          claimedBattlePassRewards: { free: [], premium: [] },
          hasBattlePassPremium: false,
        });
      },

      // Roll the season first so a purchase right at a quarter boundary (or
      // from a dialog held open across it) lands in the season the player is
      // actually buying — not stamped onto the expired one and wiped moments
      // later.
      setBattlePassPremium: (value) => {
        get().syncSeason();
        set({ hasBattlePassPremium: value });
      },
      // Atomic claim with store-side eligibility. Rolls the season first so a
      // dialog held open across a quarter boundary can't claim expired-season
      // tiers into the fresh pass; validates XP and premium ownership here
      // rather than trusting the component's (possibly stale) render.
      claimBattlePassReward: (tier, isPremium, xpRequired = 0) => {
        get().syncSeason();
        const state = get();
        if (state.seasonXP < xpRequired) return false;
        if (isPremium && !state.hasBattlePassPremium) return false;
        const key = isPremium ? 'premium' : 'free';
        if (state.claimedBattlePassRewards[key].includes(tier)) return false;
        set({
          claimedBattlePassRewards: {
            ...state.claimedBattlePassRewards,
            [key]: [...state.claimedBattlePassRewards[key], tier],
          },
        });
        return true;
      },

      addCard: (cardId) => get().addCards([cardId]),

      // Grant cards: new ids are added to the collection, duplicates are refunded
      // as coins so a pull is never worthless. Returns the coins awarded.
      addCards: (cardIds) => {
        const state = get();
        const newCards = [];
        let dupeCoins = 0;
        const owned = new Set(state.ownedCards);
        for (const id of cardIds) {
          if (owned.has(id)) {
            dupeCoins += coinsForDuplicate(id);
          } else {
            owned.add(id);
            newCards.push(id);
          }
        }

        if (newCards.length === 0 && dupeCoins === 0) return 0;

        const newOwnedCards = [...state.ownedCards, ...newCards];
        set({
          ownedCards: newOwnedCards,
          coins: state.coins + dupeCoins,
          // Count cards collected this week for the weekly "new cards" challenge.
          weekNewCards: state.weekNewCards + newCards.length,
        });
        if (newCards.length > 0) {
          // Collection ladder. The absolute thresholds below are tuned for the
          // current catalog size (64 cards) so the arc has pacing between the
          // first milestone and the full set — revisit them if the catalog
          // grows substantially again. collect_all stays relative to
          // ALL_CARDS.length, so it needs no retuning.
          get().checkAchievement('collect_20', newOwnedCards.length >= 20);
          get().checkAchievement('collect_40', newOwnedCards.length >= 40);
          get().checkAchievement('collect_55', newOwnedCards.length >= 55);
          get().checkAchievement('collect_all', newOwnedCards.length >= ALL_CARDS.length);
        }
        return dupeCoins;
      },

      // Only owned cards may enter the active deck — guards against loading a
      // stale saved deck (or any non-UI writer) that references unowned cards.
      setCurrentDeck: (cardIds) =>
        set((state) => ({ currentDeck: cardIds.filter(id => state.ownedCards.includes(id)) })),

      saveDeck: (name, cardIds) => {
        set((state) => ({
          savedDecks: [...state.savedDecks.filter(d => d.name !== name), { name, cards: cardIds }]
        }));
      },

      deleteDeck: (name) => {
        set((state) => ({
          savedDecks: state.savedDecks.filter(d => d.name !== name)
        }));
      },

      recordBattleResult: (won, damageDealt = 0, healingDone = 0, finalHP = 0, cardsPlayed = 0) => {
        const state = get();

        // All-time counters
        const newWins = won ? state.totalWins + 1 : state.totalWins;
        const newLosses = won ? state.totalLosses : state.totalLosses + 1;
        const newStreak = won ? state.currentWinStreak + 1 : 0;
        const newBestStreak = Math.max(state.bestWinStreak, newStreak);
        const newTotalDamage = state.totalDamageDealt + damageDealt;
        const newTotalHealing = state.totalHealingDone + healingDone;
        const newTotalBattles = state.totalBattles + 1;

        // Coins earned this battle (used for weekly tracking)
        const coinsThisBattle = won ? 25 + (newStreak * 5) : 5;

        // Daily stats — auto-reset when the calendar date changes
        const today = new Date().toDateString();
        const dailyReset = state.dailyStatsDate !== today;
        const newTodayWins = (dailyReset ? 0 : state.todayWins) + (won ? 1 : 0);
        const newTodayBattles = (dailyReset ? 0 : state.todayBattles) + 1;
        const newTodayDamage = (dailyReset ? 0 : state.todayDamageDealt) + damageDealt;
        const newTodayCards = (dailyReset ? 0 : state.todayCardsPlayed) + cardsPlayed;

        // Weekly stats — auto-reset on Mondays
        const weekKey = getWeekKey();
        const weeklyReset = state.weeklyStatsDate !== weekKey;
        const newWeekWins = (weeklyReset ? 0 : state.weekWins) + (won ? 1 : 0);
        const newWeekCoins = (weeklyReset ? 0 : state.weekCoinsEarned) + coinsThisBattle;
        // Best streak achieved *this week* — weekly challenges must measure
        // weekly progress, not the all-time bestWinStreak (which would make the
        // weekly streak challenge permanently complete).
        const newWeekBestStreak = Math.max(weeklyReset ? 0 : state.weekBestStreak, newStreak);

        // Clear claimed challenges for any period that just rolled over, so the
        // same daily/weekly challenge ids become claimable again. Challenge ids
        // are prefixed 'd' (daily) or 'w' (weekly).
        let newClaimedChallenges = state.claimedChallenges;
        if (dailyReset) newClaimedChallenges = newClaimedChallenges.filter(id => !id.startsWith('d'));
        if (weeklyReset) newClaimedChallenges = newClaimedChallenges.filter(id => !id.startsWith('w'));

        set({
          // All-time
          totalBattles: newTotalBattles,
          totalWins: newWins,
          totalLosses: newLosses,
          currentWinStreak: newStreak,
          bestWinStreak: newBestStreak,
          totalDamageDealt: newTotalDamage,
          totalHealingDone: newTotalHealing,
          // Daily
          todayWins: newTodayWins,
          todayBattles: newTodayBattles,
          todayDamageDealt: newTodayDamage,
          todayCardsPlayed: newTodayCards,
          dailyStatsDate: today,
          // Weekly
          weekWins: newWeekWins,
          weekCoinsEarned: newWeekCoins,
          weekBestStreak: newWeekBestStreak,
          weekNewCards: weeklyReset ? 0 : state.weekNewCards,
          weeklyStatsDate: weekKey,
          // Re-claimable challenges after a period rollover
          claimedChallenges: newClaimedChallenges,
        });

        const xpGain = won ? 50 : 20;
        get().addXP(xpGain);
        if (won) get().addCoins(coinsThisBattle);
        else get().addCoins(5); // consolation

        get().checkAchievement('first_win', newWins >= 1);
        get().checkAchievement('win_10', newWins >= 10);
        get().checkAchievement('win_50', newWins >= 50);
        get().checkAchievement('win_streak_5', newStreak >= 5);
        get().checkAchievement('play_100', newTotalBattles >= 100);
        get().checkAchievement('deal_1000_damage', newTotalDamage >= 1000);
        get().checkAchievement('heal_500', newTotalHealing >= 500);
        get().checkAchievement('perfect_win', won && finalHP === 30);
        get().checkAchievement('comeback', won && finalHP <= 5);

        return { xpGain, coinsGain: coinsThisBattle };
      },

      checkAchievement: (achievementId, condition) => {
        const state = get();
        if (condition && !state.completedAchievements.includes(achievementId)) {
          const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
          if (achievement) {
            set((s) => ({
              completedAchievements: [...s.completedAchievements, achievementId],
              coins: s.coins + achievement.reward,
              pendingAchievements: [...s.pendingAchievements, achievement],
            }));
            return achievement;
          }
        }
        return null;
      },

      // Pop and return the next queued achievement notification
      shiftPendingAchievement: () => {
        const state = get();
        if (state.pendingAchievements.length === 0) return null;
        const [first, ...rest] = state.pendingAchievements;
        set({ pendingAchievements: rest });
        return first;
      },

      claimChallenge: (challengeId) => {
        const state = get();
        if (state.claimedChallenges.includes(challengeId)) return false;
        set({ claimedChallenges: [...state.claimedChallenges, challengeId] });
        return true;
      },

      // Reset daily/weekly challenge stats and re-open their claimed ledger when
      // the calendar has rolled over. Driven by the date at read time (e.g. when
      // opening the Challenges panel) so state is correct even before the first
      // battle of the day. recordBattleResult performs the same reset inline.
      syncPeriods: () => {
        const state = get();
        const today = new Date().toDateString();
        const weekKey = getWeekKey();
        const dailyReset = state.dailyStatsDate && state.dailyStatsDate !== today;
        const weeklyReset = state.weeklyStatsDate && state.weeklyStatsDate !== weekKey;
        if (!dailyReset && !weeklyReset) return;

        let claimed = state.claimedChallenges;
        const patch = {};
        if (dailyReset) {
          claimed = claimed.filter(id => !id.startsWith('d'));
          Object.assign(patch, {
            todayWins: 0, todayBattles: 0, todayDamageDealt: 0, todayCardsPlayed: 0,
            dailyStatsDate: today,
          });
        }
        if (weeklyReset) {
          claimed = claimed.filter(id => !id.startsWith('w'));
          Object.assign(patch, {
            weekWins: 0, weekCoinsEarned: 0, weekBestStreak: 0, weekNewCards: 0,
            weeklyStatsDate: weekKey,
          });
        }
        set({ ...patch, claimedChallenges: claimed });
      },

      checkDailyLogin: () => {
        const state = get();
        const today = new Date().toDateString();
        if (state.lastLoginDate === today) return null;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const wasYesterday = state.lastLoginDate === yesterday.toDateString();
        const newConsecutive = wasYesterday ? state.consecutiveLogins + 1 : 1;
        const dayIndex = (newConsecutive - 1) % 7;
        const reward = DAILY_REWARDS[dayIndex];

        set({
          lastLoginDate: today,
          consecutiveLogins: newConsecutive,
          coins: state.coins + reward.coins,
          gems: state.gems + (reward.gems || 0),
          cardPacks: state.cardPacks + reward.packs,
        });

        if (reward.cards > 0) {
          const availableCards = ALL_CARDS.filter(c => !state.ownedCards.includes(c.id));
          const randomCards = shuffleDeck(availableCards)
            .slice(0, reward.cards)
            .map(c => c.id);
          if (randomCards.length > 0) get().addCards(randomCards);
          // Collection complete (or nearly): honor the promised cards as coins
          // so the daily reward is never silently empty.
          const shortfall = reward.cards - randomCards.length;
          if (shortfall > 0) get().addCoins(shortfall * 50);
        }

        get().checkAchievement('daily_7', newConsecutive >= 7);
        return { ...reward, day: dayIndex + 1, consecutive: newConsecutive };
      },

      addCardPack: (amount = 1, packType = 'regular') => {
        if (packType === 'premium') {
          set((state) => ({ premiumPacks: state.premiumPacks + amount }));
        } else if (packType === 'legendary') {
          set((state) => ({ legendaryPacks: state.legendaryPacks + amount }));
        } else {
          set((state) => ({ cardPacks: state.cardPacks + amount }));
        }
      },

      openCardPack: (requestedType = 'regular') => {
        // Atomically claim exactly one pack inside a single update so rapid
        // double-clicks can't open two packs or drive a counter negative.
        // Resolve the requested type if available, else fall back to any pack
        // (legendary > premium > regular).
        const field = { legendary: 'legendaryPacks', premium: 'premiumPacks', regular: 'cardPacks' };
        let packType = null;
        set((s) => {
          for (const t of [requestedType, 'legendary', 'premium', 'regular']) {
            const key = field[t];
            if (key && s[key] > 0) {
              packType = t;
              return { [key]: s[key] - 1 };
            }
          }
          return {};
        });
        if (!packType) return null; // No packs available

        const guaranteedMinRarity =
          packType === 'legendary' ? 'legendary' : packType === 'premium' ? 'rare' : null;

        const state = get();

        const getRandomRarity = (guaranteed = false) => {
          if (guaranteed === 'legendary') return 'legendary';
          if (guaranteed === 'rare') {
            const roll = Math.random() * 100;
            if (roll < 5) return 'legendary';
            if (roll < 25) return 'epic';
            return 'rare';
          }
          const roll = Math.random() * 100;
          if (roll < 1) return 'legendary';
          if (roll < 6) return 'epic';
          if (roll < 21) return 'rare';
          if (roll < 51) return 'uncommon';
          return 'common';
        };

        const pulledCards = [];
        const packSize = guaranteedMinRarity === 'legendary' ? 10 : 5;

        for (let i = 0; i < packSize; i++) {
          let rarity;
          if (i === 0 && guaranteedMinRarity === 'legendary') {
            rarity = 'legendary';
          } else if (i === 0 && guaranteedMinRarity === 'rare') {
            rarity = getRandomRarity('rare');
          } else {
            rarity = getRandomRarity();
          }

          let cardsOfRarity = ALL_CARDS.filter(c => c.rarity === rarity);

          // Fallback: if no cards exist for this rarity, try lower rarities
          if (cardsOfRarity.length === 0) {
            const rarityFallback = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
            const currentIndex = rarityFallback.indexOf(rarity);
            for (let j = currentIndex + 1; j < rarityFallback.length; j++) {
              cardsOfRarity = ALL_CARDS.filter(c => c.rarity === rarityFallback[j]);
              if (cardsOfRarity.length > 0) break;
            }
          }

          // If still no cards found, skip this slot (shouldn't happen with proper card pool)
          if (cardsOfRarity.length === 0) continue;

          const randomCard = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
          pulledCards.push({
            ...randomCard,
            isNew: !state.ownedCards.includes(randomCard.id) && !pulledCards.find(pc => pc.id === randomCard.id),
          });
        }

        const dupeCoins = get().addCards(pulledCards.map(c => c.id));

        return { cards: pulledCards, dupeCoins };
      },

      // Helper to get total available packs of all types
      getTotalPacks: () => {
        const state = get();
        return state.cardPacks + state.premiumPacks + state.legendaryPacks;
      },

      // Get the next pack type to open (prioritizes special packs)
      getNextPackType: () => {
        const state = get();
        if (state.legendaryPacks > 0) return 'legendary';
        if (state.premiumPacks > 0) return 'premium';
        if (state.cardPacks > 0) return 'regular';
        return null;
      },

      buyShopItem: (itemId) => {
        const state = get();
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: "Item not found" };

        if (item.currency === 'coins') {
          if (state.coins < item.price) return { success: false, message: "Not enough coins" };
          set({ coins: state.coins - item.price });
        } else if (item.currency === 'gems') {
          if (state.gems < item.price) return { success: false, message: "Not enough gems" };
          set({ gems: state.gems - item.price });
        }

        if (item.type === 'pack') {
          set((s) => ({ cardPacks: s.cardPacks + item.quantity }));
          return { success: true, message: `Got ${item.quantity} pack(s)!`, type: item.type };
        }
        if (item.type === 'premium') {
          set((s) => ({ premiumPacks: s.premiumPacks + item.quantity }));
          return { success: true, message: `Got ${item.quantity} premium pack(s)!`, type: item.type };
        }
        if (item.type === 'legendary') {
          set((s) => ({ legendaryPacks: s.legendaryPacks + item.quantity }));
          return { success: true, message: `Got ${item.quantity} legendary pack(s)!`, type: item.type };
        }
        if (item.type === 'coins') {
          set((s) => ({ coins: s.coins + item.quantity }));
          return { success: true, message: `Got ${item.quantity} coins!` };
        }

        return { success: false, message: "Unknown item type" };
      },

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setMusicEnabled: (enabled) => set({ musicEnabled: enabled }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setTutorialCompleted: (completed) => set({ tutorialCompleted: completed }),

      resetProgress: () => set({ ...initialState, pendingAchievements: [] }),
    }),
    {
      name: 'terrible-teddies-storage',
      version: 3,
      // Don't persist in-flight UI state
      partialize: (state) => {
        const { pendingAchievements, ...rest } = state;
        return rest;
      },
      // Normalize state persisted by any earlier release: fill in fields added
      // later, repair nested shapes, and coerce corrupt numerics. Without this a
      // returning player's stale localStorage can crash on reads like
      // claimedBattlePassRewards.premium.includes(...) or surface NaN balances.
      migrate: (persisted) => {
        const s = { ...initialState, ...(persisted || {}) };

        s.claimedBattlePassRewards = {
          free: persisted?.claimedBattlePassRewards?.free ?? [],
          premium: persisted?.claimedBattlePassRewards?.premium ?? [],
        };
        s.claimedChallenges = Array.isArray(persisted?.claimedChallenges) ? persisted.claimedChallenges : [];
        // Pre-rollover saves have no season stamp — null means "stamp without
        // resetting" on the first syncSeason(), grandfathering their progress.
        s.seasonKey = typeof persisted?.seasonKey === 'string' ? persisted.seasonKey : null;
        s.ownedCards = Array.isArray(persisted?.ownedCards) && persisted.ownedCards.length
          ? persisted.ownedCards : [...initialState.ownedCards];
        s.currentDeck = Array.isArray(persisted?.currentDeck) ? persisted.currentDeck : [...initialState.currentDeck];
        s.savedDecks = Array.isArray(persisted?.savedDecks) ? persisted.savedDecks : [];
        s.completedAchievements = Array.isArray(persisted?.completedAchievements) ? persisted.completedAchievements : [];

        // seasonXP was added in v3 — for players whose persisted state predates
        // it, seed from cumulative level progress so the Battle Pass doesn't
        // reset to tier 0. Test the *raw* persisted value: the merged `s` has
        // already picked up the initialState default of 0.
        const persistedSeason = persisted?.seasonXP;
        if (typeof persistedSeason !== 'number' || Number.isNaN(persistedSeason)) {
          const baseLevel = Number(persisted?.level) || 1;
          let seeded = Number(persisted?.xp) || 0;
          for (let lvl = 1; lvl < baseLevel; lvl++) seeded += getXPForLevel(lvl);
          s.seasonXP = seeded;
        }

        for (const k of ['coins', 'gems', 'xp', 'level', 'cardPacks', 'premiumPacks',
          'legendaryPacks', 'weekWins', 'weekCoinsEarned', 'weekBestStreak', 'weekNewCards',
          'consecutiveLogins', 'totalWins', 'totalLosses', 'currentWinStreak', 'bestWinStreak',
          'lastSyncedServerGems']) {
          if (typeof s[k] !== 'number' || Number.isNaN(s[k])) s[k] = initialState[k];
        }
        return s;
      },
    }
  )
);

export default useGameStore;
