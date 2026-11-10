import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { browserLocalStorage } from '@/lib/safeStorage';
import { createStore } from 'zustand/vanilla';
import { shuffleDeck } from '@/utils/deckUtils';
import { getCurrentSeason, getSeason, seasonFromKey } from '@/utils/season';
import { BATTLE_PASS_REWARDS, readyRewards, passOf, describeGrants } from '@/lib/battlePass';
import analytics from '@/utils/analytics';
import { nextDailyRecord } from '@/lib/dailyFight';
import { AFTER_HOURS_CARDS } from '@/data/afterHoursCards';
import { QUICKIE_CARDS } from '@/data/quickieCards';
import { NIGHT_TWO_CARDS } from '@/data/nightTwoCards';
import { HEN_DO_CARDS } from '@/data/henDoHavoc';
import { CHUCK_CATALOG } from '@/data/chuckCrew';
import { LAST_ORDERS_CARDS } from '@/data/expansion-last-orders';
import { MORNING_AFTER_CARDS } from '@/data/expansionMorningAfter';
import { resolveLogin, weekCoinBonus } from '@/lib/loginStreak';
import { comebackFor } from '@/lib/comeback';
import { DAILY_POOL, WEEKLY_POOL, normalizeRerolls, replacementFor, rerollPatch, visibleChallenges, weekKeyOf } from '@/lib/questReroll';
import { bookOf, normalizeClaimedSets } from '@/lib/collectionBook';
import { titleById } from '@/lib/titles';
import {
  quoteWardrobe, cardBackId, boardId, finishId, avatarId, lineId,
  DEFAULT_CARD_BACK, DEFAULT_BOARD, DEFAULT_FINISH, DEFAULT_AVATAR, DEFAULT_LINE,
} from '@/lib/wardrobe';
import { clampVolume } from '@/lib/audioMix';
import { eventAt, eventSpentKey, isEventId, scaleReward } from '@/lib/houseEvents';
import { crawlStatus, CRAWL_UNLOCK_BATTLES } from '@/lib/barCrawl';
import {
  bonusForOpen, cardsByRarity, openAllowed, rollPack, settlePull, streakCoins,
} from '@/lib/packEconomy';
import {
  CRAWL_SKIPS_PER_DAY, CRAWL_STOP_WAIT_MS, PAID_REROLLS_PER_DAY, REROLL_GEMS,
  convenienceById, crawlBoard, deckSlotsFor, storageSlotsFor,
} from '@/lib/convenience';
import { nextStarTarget, starCost, starSetReady, starringUnlocked, normalizeStars, STAR_CAP } from '@/lib/cardStars';
import { morningAfterDue, MORNING_AFTER } from '@/lib/morningAfter';
import { trackRow } from '@/lib/levelTrack';
import { catchUpFor } from '@/lib/catchUp';
import { storyChapters, STORY_CHAPTERS } from '@/lib/storyCampaign';
import { plaqueById, plaqueBonus } from '@/lib/plaques';
import { syncConvenience, syncPackWin, requestPackRoll } from '@/lib/packSync';

export const ALL_CARDS = [
  // Common (Starter Cards)
  { id: 1, name: "Shitstarter Ted", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common', description: "Every bar fight in this town starts with Ted." },
  { id: 2, name: "Feral Tim", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'swarm', rarity: 'common', description: "Raised in the alley. The alley is still pressing charges." },
  { id: 3, name: "Fluffy McFuckface", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common', description: "Legally changed his name. Won the bet." },
  { id: 4, name: "Bar-Fight Barry", attack: 2, defense: 1, type: 'action', cost: 1, ability: 'none', rarity: 'common', description: "Banned from six pubs and the honeymoon suite." },
  { id: 5, name: "Stitches the Snitch", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'none', rarity: 'common', description: "Held together by thread and plea deals." },

  // Uncommon
  { id: 6, name: "Shit-Talk Sally", attack: 2, defense: 3, type: 'action', cost: 2, ability: 'taunt', rarity: 'uncommon', description: "Runs her mouth until you HAVE to hit her. That's the plan." },
  { id: 7, name: "Peeping Pete", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'stealth', rarity: 'uncommon', description: "You can't target what's hiding in your hamper." },
  { id: 8, name: "Chokehold Cuddles", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'shield', rarity: 'uncommon', description: "His hugs are technically a submission move." },
  { id: 9, name: "Shiv-in-a-Pillow", attack: 4, defense: 1, type: 'action', cost: 3, ability: 'piercing', rarity: 'uncommon', description: "Soft on the outside. Very much not on the inside. Nobody sleeps with him twice." },
  { id: 10, name: "Anger-Management Gus", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'fury', rarity: 'uncommon', description: "Dropped out of the program. The program was relieved." },

  // Rare
  { id: 11, name: "Restraining-Order Randy", attack: 1, defense: 5, type: 'action', cost: 3, ability: 'protect', rarity: 'rare', description: "You legally cannot get within 50 feet of his friends." },
  { id: 12, name: "'Roid-Rage Reggie", attack: 2, defense: 3, type: 'action', cost: 3, ability: 'fury', rarity: 'rare', description: "The stuffing is 90% pre-workout." },
  { id: 13, name: "The F-Bomb", attack: 5, defense: 1, type: 'action', cost: 4, ability: 'none', rarity: 'rare', description: "Drops hard. Offends everyone. No survivors." },
  { id: 14, name: "Slumlord Cotton", attack: 3, defense: 3, type: 'action', cost: 4, ability: 'royal', rarity: 'rare', description: "Owns half the toy chest. Rents it by the hour. Bills by the stain." },
  { id: 15, name: "Tax-Fraud Teddy", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'stealth', rarity: 'rare', description: "Officially, he doesn't exist. Ask his accountant." },

  // Epic
  { id: 16, name: "Lord Fluffington, Disgraced", attack: 4, defense: 3, type: 'action', cost: 5, ability: 'shield', rarity: 'epic', description: "Lost the estate to a lap dancer. She's technically a duchess now." },
  { id: 17, name: "Blackout Bjorn", attack: 6, defense: 1, type: 'action', cost: 4, ability: 'fury', rarity: 'epic', description: "Remembers nothing. Regrets everything. Hits like a truck." },
  { id: 18, name: "Grandpa Warcrimes", attack: 2, defense: 6, type: 'action', cost: 5, ability: 'protect', rarity: 'epic', description: "Don't ask what he did in the Pillow Wars. He'll tell you." },
  { id: 19, name: "The Seam Reaper", attack: 5, defense: 3, type: 'action', cost: 5, ability: 'piercing', rarity: 'epic', description: "Every bear's last date. Brings his own scissors, never calls." },

  // Legendary
  { id: 20, name: "The Godfluffer", attack: 5, defense: 5, type: 'action', cost: 6, ability: 'taunt', rarity: 'legendary', description: "Leave the gun. Take the lube." },
  { id: 21, name: "Fluffpocalypse Now", attack: 7, defense: 3, type: 'action', cost: 6, ability: 'fury', rarity: 'legendary', description: "Loves the smell of stuffing in the morning." },

  // Trap Cards
  { id: 30, name: "Honey Trap", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3, rarity: 'common', description: "He only came up for a nightcap. The nightstand had teeth." },
  { id: 31, name: "Hug With Consequences", attack: 0, defense: 0, type: 'trap', cost: 1, effect: 'damage', amount: 2, rarity: 'common', description: "It felt nice for one second. The bruise sends a thank-you." },
  { id: 32, name: "Premature Detonation", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, rarity: 'uncommon', description: "It happens to lots of traps. Don't make it weird." },
  { id: 33, name: "Full Metal Buttons", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 3, rarity: 'uncommon', description: "A quarter buys a shock. Not the kind you came for." },
  { id: 34, name: "Cuddle Homicide", attack: 0, defense: 0, type: 'trap', cost: 4, effect: 'damage', amount: 6, rarity: 'rare', description: "The coroner ruled it 'death by affection.'" },

  // Special Cards
  { id: 40, name: "Emergency Fluff Job", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'heal', amount: 5, rarity: 'common', description: "Quick, discreet, cash only." },
  { id: 41, name: "Honey on the Rocks", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'draw', amount: 2, rarity: 'common', description: "Bartender knows the order. Draw two, tell no one." },
  { id: 42, name: "Bloodshot Button Eyes", attack: 0, defense: 0, type: 'special', cost: 1, effect: 'draw', amount: 1, rarity: 'common', description: "Haven't slept since the divorce. See everything." },
  { id: 43, name: "Back-Alley Surgery", attack: 0, defense: 0, type: 'special', cost: 4, effect: 'heal', amount: 8, rarity: 'uncommon', description: "No license, no anesthesia, no questions." },
  { id: 44, name: "Profanity Pep Talk", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'buff', amount: 1, rarity: 'uncommon', description: "Every third word is bleeped. The rest is mostly 'fuck' and 'proud of you.'" },
  { id: 45, name: "Fluffing Bender", attack: 0, defense: 0, type: 'special', cost: 4, effect: 'draw', amount: 3, rarity: 'rare', description: "Three cards deep and still going. Tomorrow's problem." },
  { id: 46, name: "The Full Refluff", attack: 0, defense: 0, type: 'special', cost: 6, effect: 'heal', amount: 15, rarity: 'epic', description: "Head-to-toe restuffing. You didn't hear about the clinic from us." },
  { id: 47, name: "Last Call Blessing", attack: 0, defense: 0, type: 'special', cost: 5, effect: 'buff', amount: 2, rarity: 'legendary', description: "One more round for everybody. Including the two under the pool table." },

  // ——— The Barfly Expansion ———
  // Twenty new bears (ids 50-69). Abilities are restricted to the ones the
  // engine actually implements (taunt/protect/stealth targeting; shield/
  // piercing/fury combat) — see cardSchema.test.js, which enforces this.
  { id: 50, name: "Dumpster Dave", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'stealth', rarity: 'common', description: "Lives behind the bar. You won't see him coming out of it." },
  { id: 51, name: "Mange Marvin", attack: 3, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common', description: "The bald patches are from stress, cheap bleach, and a long weekend." },
  { id: 52, name: "Two-Beer Tina", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'fury', rarity: 'common', description: "Two beers in and she's everyone's problem. Three beers in and she's unstoppable." },
  { id: 53, name: "Coupon Carl", attack: 1, defense: 2, type: 'action', cost: 1, ability: 'none', rarity: 'common', description: "Fights dirty, tips in singles, and smells like the carpet." },
  { id: 54, name: "Sticky Mickey", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'protect', rarity: 'common', description: "Nobody asks why he's sticky. He's not going anywhere, and neither is whoever's behind him." },
  { id: 55, name: "Ashtray Annie", attack: 1, defense: 2, type: 'action', cost: 1, ability: 'shield', rarity: 'common', description: "Smells like 1987 and menthols. Burned through three husbands and a mattress." },
  { id: 56, name: "Bouncer Bruno", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'taunt', rarity: 'uncommon', description: "You're not on the list. Nobody is on the list." },
  { id: 57, name: "Hairball Harriet", attack: 3, defense: 2, type: 'action', cost: 3, ability: 'piercing', rarity: 'uncommon', description: "Swallows anything once. Returns most of it." },
  { id: 58, name: "Prison-Wine Pierre", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'fury', rarity: 'uncommon', description: "Ferments grudges in a toilet. Delicious." },
  { id: 59, name: "Glitter Lungs", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'stealth', rarity: 'uncommon', description: "Inhaled a craft store in '09. Still sparkles when he coughs." },
  { id: 60, name: "Beargaritaville", attack: 2, defense: 2, type: 'action', cost: 2, ability: 'shield', rarity: 'uncommon', description: "Wasting away again. Salt on the rim, a lime in the eye." },
  { id: 61, name: "Snitchslap Sue", attack: 3, defense: 3, type: 'action', cost: 3, ability: 'none', rarity: 'uncommon', description: "Slapped the groom, slept with the best man, wore a wire to both." },
  { id: 62, name: "Chainsmoke Chad", attack: 4, defense: 2, type: 'action', cost: 3, ability: 'fury', rarity: 'rare', description: "Lights the next one off your burning deck." },
  { id: 63, name: "Bail-Money Bonnie", attack: 2, defense: 4, type: 'action', cost: 3, ability: 'protect', rarity: 'rare', description: "She knows a guy. She IS the guy." },
  { id: 64, name: "Sgt. Snuggles, Dishonorable", attack: 4, defense: 3, type: 'action', cost: 4, ability: 'shield', rarity: 'rare', description: "Court-martialed for fraternizing. With the entire tribunal." },
  { id: 65, name: "The Debt Collector", attack: 5, defense: 1, type: 'action', cost: 4, ability: 'piercing', rarity: 'rare', description: "Your kneecaps called. They're nervous." },
  { id: 66, name: "Mama Mauls", attack: 5, defense: 3, type: 'action', cost: 5, ability: 'taunt', rarity: 'epic', description: "The apron stays on. The rolling pin does not." },
  { id: 67, name: "Whiskey Priest", attack: 3, defense: 5, type: 'action', cost: 5, ability: 'protect', rarity: 'epic', description: "Absolves everything but his own tab." },
  { id: 68, name: "Duke of Dumpsterfire", attack: 6, defense: 2, type: 'action', cost: 5, ability: 'fury', rarity: 'epic', description: "Royalty of the alley. Exes report a burning sensation. So does the fire marshal." },
  { id: 69, name: "Big Spoon, Last Warning", attack: 6, defense: 4, type: 'action', cost: 6, ability: 'shield', rarity: 'legendary', description: "The cuddle is mandatory. The survival is optional." },

  // Five new traps (ids 70-74) and five new specials (ids 75-79). Specials
  // only use effects applySpecialEffect implements: heal / draw / buff.
  { id: 70, name: "Glass in the Gummy Bears", attack: 0, defense: 0, type: 'trap', cost: 2, effect: 'damage', amount: 4, rarity: 'common', description: "Chewy, then a clinic, then a story you will not tell sober." },
  { id: 71, name: "Wet Floor, No Sign", attack: 0, defense: 0, type: 'trap', cost: 1, effect: 'damage', amount: 2, rarity: 'common', description: "Beer, glitter and a third liquid. The mop quit rather than ask." },
  { id: 72, name: "Loaded Claw Machine", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, rarity: 'uncommon', description: "Rigged? Obviously. Everybody pays to get grabbed. Nobody takes the prize home." },
  { id: 73, name: "Last Call Stampede", attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, rarity: 'uncommon', description: "Five words: two for one tequila night." },
  { id: 74, name: "The Ol' Honey Bucket", attack: 0, defense: 0, type: 'trap', cost: 4, effect: 'damage', amount: 6, rarity: 'rare', description: "Honey, bent nails and a necktie. Nobody has asked whose." },
  { id: 75, name: "Hair of the Bear", attack: 0, defense: 0, type: 'special', cost: 2, effect: 'heal', amount: 3, rarity: 'common', description: "Cures what the bar did. Causes what the bar will." },
  { id: 76, name: "Minibar Raid", attack: 0, defense: 0, type: 'special', cost: 1, effect: 'heal', amount: 2, rarity: 'common', description: "Tiny bottles. Tiny crimes. Tiny recovery." },
  { id: 77, name: "The Group Chat Leaks", attack: 0, defense: 0, type: 'special', cost: 5, effect: 'draw', amount: 4, rarity: 'rare', description: "Everyone's secrets, face up. Draw four, lose friends." },
  { id: 78, name: "Bar-Top Baptism", attack: 0, defense: 0, type: 'special', cost: 5, effect: 'heal', amount: 10, rarity: 'rare', description: "Fully submerged in the good stuff. Born again, smells worse." },
  { id: 79, name: "Suspicious Brownies", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'draw', amount: 2, rarity: 'uncommon', description: "Don't ask what's in them. Draw two, feel weird later." },
  ...AFTER_HOURS_CARDS,
  ...QUICKIE_CARDS,
  ...NIGHT_TWO_CARDS,
  ...HEN_DO_CARDS,
  ...LAST_ORDERS_CARDS,
  ...MORNING_AFTER_CARDS,
  ...CHUCK_CATALOG,
];

// The HP at which the night is nearly over for a side. One number for the
// three things that must agree on it: the battle board's "last call" (the
// house lights come up the first time either side is this low), the comeback
// achievement's rule in recordBattleResult, and the words that rule is
// advertised in. Above ACHIEVEMENTS because the description is built from it.
export const LAST_CALL_HP = 5;

// `icon` names the badge drawn for each, on its unlock toast and in Player
// Stats: src/lib/achievementIcons.js maps the name to a line icon. A name,
// not the component, so the store stays plain data. They were emoji, which
// every platform draws differently.
//
// `locked` is the House's caption under the criterion, drawn by Player Stats
// only while the row is locked (single-quoted, after `icon`).
export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Someone Got Lucky', description: 'Win your first battle', reward: 100, icon: 'Trophy', locked: 'Zero. Fucking embarrassing.' },
  { id: 'win_10', name: 'Ten Priors', description: 'Win 10 battles', reward: 500, icon: 'Award', locked: 'Squeaky clean. Disgusting.' },
  { id: 'win_50', name: 'Chuck Has a Lawyer', description: 'Win 50 battles', reward: 2000, icon: 'Crown', locked: 'Chuck’s representing himself.' },
  { id: 'win_streak_5', name: 'Burns When You Win', description: 'Win 5 battles in a row', reward: 300, icon: 'Flame', locked: 'Haven’t caught anything yet.' },
  { id: 'collect_20', name: 'Five-Finger Discount', description: 'Collect 20 unique cards', reward: 400, icon: 'Library', locked: 'Hands visible at all times.' },
  { id: 'collect_40', name: 'Keeps Every Hoodie', description: 'Collect 40 unique cards', reward: 1000, icon: 'Archive', locked: 'Gave the hoodie back.' },
  { id: 'collect_55', name: 'Problem Collector', description: 'Collect 55 unique cards', reward: 2500, icon: 'Warehouse', locked: 'No problem. Yet.' },
  { id: 'collect_all', name: 'Has a Guy for That', description: 'Collect all cards', reward: 10000, icon: 'BadgeCheck', locked: 'Your guy is still looking.' },
  { id: 'play_100', name: 'Called in Sick', description: 'Play 100 battles', reward: 1000, icon: 'Gamepad2', locked: 'Your boss still trusts you.' },
  { id: 'deal_1000_damage', name: 'Walks Funny Now', description: 'Deal 1000 total damage', reward: 500, icon: 'Bomb', locked: 'Everybody walks fine.' },
  { id: 'heal_500', name: 'Fluffer on Call', description: 'Heal 500 total HP', reward: 300, icon: 'HeartPulse', locked: 'Still self-service.' },
  { id: 'perfect_win', name: 'Didn’t Spill a Drop', description: 'Win without losing HP', reward: 1000, icon: 'ShieldCheck', locked: 'Spilled plenty so far.' },
  { id: 'comeback', name: 'Crawled Home Smiling', description: `Win with ${LAST_CALL_HP} or less HP`, reward: 500, icon: 'Swords', locked: 'Never been that desperate.' },
  { id: 'level_10', name: 'Third Date Energy', description: 'Reach level 10', reward: 500, icon: 'ChevronsUp', locked: 'Still free to walk away.' },
  { id: 'level_25', name: 'Too Old for This Shit', description: 'Reach level 25', reward: 1500, icon: 'Medal', locked: 'Nobody lives that long.' },
  { id: 'daily_7', name: 'Seven-Night Stand', description: 'Log in 7 days in a row', reward: 700, icon: 'CalendarCheck', locked: 'Commitment issues.' },
  { id: 'win_100', name: 'Hundred-Night Stand', description: 'Win 100 battles', reward: 4000, icon: 'Skull', locked: 'Hasn’t earned a nickname.' },
  { id: 'win_streak_10', name: 'Won’t Tap Out', description: 'Win 10 battles in a row', reward: 800, icon: 'Zap', locked: 'Tapped out after one. Rude.' },
  { id: 'level_50', name: 'Keeps a Drawer Here', description: 'Reach level 50', reward: 3000, icon: 'KeyRound', locked: 'Still a toothbrush short.' },
  { id: 'daily_30', name: 'They Save Your Stool', description: 'Log in 30 days in a row', reward: 2500, icon: 'CalendarRange', locked: 'Still introducing yourself.' },
  { id: 'comeback_3', name: 'Crawls Back Grinning', description: `Win 3 battles at ${LAST_CALL_HP} HP or less`, reward: 1200, icon: 'Undo2', locked: 'One happy ending was enough.' },
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

/**
 * The day of the seven a daily claim made at `now` pays, and the streak it
 * records. Yesterday continues it. Exactly one missed night continues it too
 * when a shield is banked (resolveLogin). Anything wider starts again at day
 * 1. checkDailyLogin pays from the same resolution, and Daily Rewards lights
 * the same tile as Today before the tap, so the two cannot disagree.
 */
export const dailyClaimDay = (state, now = new Date()) => {
  const resolved = resolveLogin(state, now, DAILY_REWARDS.length);
  return { day: resolved.day, streak: resolved.streak };
};

// Both storefronts (the Shop and the Card Packs table) render from this one
// table: `description` on the Shop's tiles, `short` on the compact Card Packs
// tiles. shopCopy.test.js checks the claims in both against the prices.
export const SHOP_ITEMS = [
  { id: 'pack_1', name: 'Card Pack', description: '5 filthy cards. Open in a stall.', short: '5 cards. Open in a stall.', icon: '📦', price: 200, currency: 'coins', type: 'pack', quantity: 1 },
  { id: 'pack_5', name: '5 Card Packs', description: '25 random cards (10% off). Hide the keys.', short: '25 cards · 10% off. Hide the keys.', icon: '📦', price: 900, currency: 'coins', type: 'pack', quantity: 5 },
  { id: 'pack_10', name: '10 Card Packs', description: '50 random cards (20% off). Call in sick.', short: '50 cards · 20% off. Call in sick.', icon: '📦📦', price: 1600, currency: 'coins', type: 'pack', quantity: 10 },
  // Gem packs match the small coin bag: 10 gems buy 500 coins, and a pack is
  // 200 coins, so one pack is 4 gems and two packs are 8. The large bag is
  // the better coins-per-gem. Same odds either way. See the PR value table.
  { id: 'premium_pack', name: 'Premium Pack', description: '5 cards. Same odds as a Card Pack.', short: '5 cards. Same odds.', icon: '💎', price: 4, currency: 'gems', type: 'premium', quantity: 1 },
  { id: 'legendary_pack', name: 'Legendary Pack', description: '10 cards. Same odds as a Card Pack.', short: '10 cards. Same odds.', icon: '⭐', price: 8, currency: 'gems', type: 'legendary', quantity: 1 },
  { id: 'coins_small', name: 'Small Coin Bag', description: '+500 coins. For the cheap rounds.', icon: '💰', price: 10, currency: 'gems', type: 'coins', quantity: 500 },
  { id: 'coins_large', name: 'Large Coin Bag', description: '+3,000 coins. Unmarked. Like you.', icon: '💰', price: 50, currency: 'gems', type: 'coins', quantity: 3000 },
  // Timed booster rather than a lump sum: pays out only as you play, so it
  // rewards an active day instead of being a flat coin bag (those already
  // exist above at a guaranteed rate). Priced between the two bags — it beats
  // coins_small for anyone who plays more than ~10 battles in the window.
  { id: 'coin_doubler', name: 'Coin Doubler', description: 'Double battle coins for 24h. Sin.', icon: '🪙', price: 25, currency: 'gems', type: 'booster', durationHours: 24 },
];

// One odds table for every pack. Gem packs and earned-coin packs roll this
// same table, share one pity timer and one sell-back. Gems buy time, not cards.
export const PACK_ODDS = {
  standard: [['legendary', 1], ['epic', 5], ['rare', 15], ['uncommon', 30], ['common', 49]],
};

// What each tier holds. The size is the only difference, and it is posted.
// Every card, including the first, rolls on PACK_ODDS.standard.
export const PACK_SLOTS = {
  regular: { size: 5, first: 'standard' },
  premium: { size: 5, first: 'standard' },
  legendary: { size: 10, first: 'standard' },
};

/**
 * One rarity from an odds table: walks the cumulative weights. `roll` is a
 * number in [0, total) — Math.random() scaled by default; tests pass it.
 */
export const rollRarity = (table, roll = Math.random() * table.reduce((n, [, w]) => n + w, 0)) => {
  let edge = 0;
  for (const [rarity, weight] of table) {
    edge += weight;
    if (roll < edge) return rarity;
  }
  return table[table.length - 1][0];
};

// The XP a level takes. Exported for the cloud save's progress measure, which
// counts lifetime XP (src/lib/cloudSave.js).
export const getXPForLevel = (level) => Math.floor(100 * Math.pow(1.5, level - 1));

// Ids for queued level-up announcements. Module-wide and never reset, so an id
// is unique for the whole session, across progress resets and account swaps.
let levelUpSeq = 0;
// The same, for the season-end deliveries syncSeason queues.
let deliverySeq = 0;

// Season XP a battle pays (recordBattleResult), win or lose. Exported so the
// Battle Pass can say how XP is earned from the figures that pay it.
export const BATTLE_XP = { win: 50, loss: 20 };

// Coins refunded when a card pull duplicates one you already own, so paid packs
// always have value even for near-complete collections.
const DUPLICATE_COIN_VALUE = { common: 10, uncommon: 20, rare: 40, epic: 75, legendary: 150 };
// Exported so a reward that is a card can say, before it is claimed, what it
// pays a player who already owns it.
export const coinsForDuplicate = (cardId) => {
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
  // Which account this save belongs to. The persisted store is one device-wide
  // localStorage key, so without an owner stamp a second account signing in on
  // the same device inherits the first player's coins, cards, level AND their
  // lastSyncedServerGems high-water mark — which silently breaks their
  // purchases (see bindToUser).
  ownerUserId: null,
  coins: 500,
  gems: 10,
  // Gems a reversed payment took back that had already been spent: the part
  // of the clawback the balance could not cover (reconcileServerGems). The
  // next gems in, bought or earned, pay it off before they reach the balance,
  // so a buy, spend, chargeback, won dispute cannot end with the goods and
  // the gems both. Never negative; while it is above 0, gems is 0.
  gemDebt: 0,
  // Convenience spends already taken off the local balance whose server
  // receipt has not been applied yet. A reconcile that sees the server drop
  // by one of these amounts moves the high-water mark and does not treat it
  // as a chargeback, which is what happened when the receipt response was lost.
  pendingGemCharges: [],
  ownedCards: [1, 2, 3, 4, 5, 6, 30, 31, 40, 41, 42],
  currentDeck: [1, 2, 3, 4, 5, 6, 30, 40, 41, 42],
  savedDecks: [],
  // Pack ledger. Pity, the day's sell-back and the day's opens live here so a
  // reload cannot reset them. Gem packs use the same numbers.
  packPity: 0,
  packOpens: 0,
  packCoinSpent: 0,
  packCoinBack: 0,
  sellbackToday: 0,
  sellbackDay: null,
  earnedOpensToday: 0,
  earnedOpensDay: null,
  packStreakDay: null,
  instantOpen: false,
  decksUnlocked: false,
  storageUnlocked: false,
  bonusDeckSlot: false,
  firstConvenience: false,
  starterOfferDismissed: false,
  skipDay: null,
  skipsToday: 0,
  shieldBoughtDay: null,
  paidRerollDay: null,
  paidRerollsToday: 0,
  crawlTimer: false,
  crawlGateUntil: 0,
  crawlGatedStop: null,
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
  weekStreak: 0,      // running win streak scoped to THIS week (resets Mondays / on a loss)
  weekBestStreak: 0,
  weekNewCards: 0,
  weeklyStatsDate: null,
  // Claimed challenge IDs (persisted so players can't double-claim)
  claimedChallenges: [],
  // System
  completedAchievements: [],
  lastLoginDate: null,
  consecutiveLogins: 0,
  // One banked forgiveness. Finishing a 7-night cycle fills it; exactly one
  // missed night spends it and the streak holds. It does not stack.
  streakShields: 0,
  // Wins taken at last call. The one-off comeback achievement does not count
  // them, so a third one can pay a title of its own.
  comebackWins: 0,
  // Daily and weekly quest rerolls (src/lib/questReroll.js). A swap counts
  // only while its day or week key still matches.
  questRerolls: {
    dailyKey: null,
    weeklyKey: null,
    dailyUsed: 0,
    weeklyUsed: 0,
    dailySwap: null,
    weeklySwap: null,
  },
  // Rarity sets whose collection-book reward has been claimed.
  claimedSets: [],
  // The house title being worn (src/lib/titles.js), or null.
  equippedTitle: null,
  // One armed limited night (src/lib/houseEvents.js), and the day|id already used.
  eventArmed: null,
  eventSpent: null,
  // Weekly crawl counters. They reset with the other weekly stats.
  weekBattles: 0,
  weekDamage: 0,
  weekCards: 0,
  crawlClaimedWeek: null,
  // Card stars, keyed by id string, 1 to 3. Dupes still pay coins.
  cardStars: {},
  claimedStarSets: [],
  lastBattleDate: null,
  morningAfterDate: null,
  firstSeenDate: null,
  catchUpWeek: null,
  claimedLevelRewards: [],
  claimedPlaques: [],
  claimedChapters: [],
  cardPacks: 1,
  premiumPacks: 0,
  legendaryPacks: 0,
  soundEnabled: true,
  animationsEnabled: true,
  // This device's mixer. Mute wins over both faders. Music stays off until
  // the player asks: a bar that starts singing on a returning phone is a
  // surprise, and these never leave the device (DEVICE_FIELDS).
  musicOn: false,
  musicVolume: 0.7,
  sfxVolume: 1,
  audioMuted: false,
  // A short buzz on a sit-down, a buy, or putting a look on. Off until asked.
  // Many phones, including iOS, have no vibration API and stay quiet.
  hapticsEnabled: false,
  // Display, also this device only. `larger` is the top of three, and the
  // colourblind switch swaps rarity inks for ones that stay apart.
  textSize: 'default',
  colorblindSafe: false,
  // New players start on 'easy' for a gentler first session (the AI is a real
  // threat under the creature-HP combat model); they can ramp up in Settings.
  // Only affects fresh saves — returning players keep their persisted choice.
  difficulty: 'easy',
  tutorialCompleted: false,
  // The easy-mode first fight (Warming Up, then the first legal attack).
  // False on a new save. A save from before the lesson, once it has a battle
  // on it, is treated as already seen (normalizeSave).
  firstFightSeen: false,
  // The nightly fight (src/lib/dailyFight.js). The key is the player's local
  // calendar day. A result of null means tonight has not been sat.
  dailyKey: null,
  dailyResult: null,
  dailyStreak: 0,
  dailyBest: 0,
  // Battle Pass
  hasBattlePassPremium: false,
  claimedBattlePassRewards: { free: [], premium: [] },
  // Cosmetic entitlements (borders, emotes) unlocked from premium Battle Pass
  // tiers, persisted by name (src/lib/cosmetics.js draws them). Before this,
  // claiming an 'exclusive' tier recorded the tier as claimed but granted
  // nothing at all. They are the player's to keep: a season's end resets the
  // pass, never what it unlocked (it used to clear these too, so the borders a
  // 500-gem pass sold vanished at the quarter).
  unlockedCosmetics: [],
  // Which bought (or free) look is on the cards and the cloth. Ids from
  // src/lib/wardrobe.js. They travel with the save; a missing or unknown id
  // is the house look (normalizeSave).
  equippedCardBack: DEFAULT_CARD_BACK,
  equippedBoard: DEFAULT_BOARD,
  equippedFinish: DEFAULT_FINISH,
  equippedAvatar: DEFAULT_AVATAR,
  equippedLine: DEFAULT_LINE,
  // Coin Doubler booster: epoch ms at which the 2x battle-coin multiplier
  // lapses, or null when it has never been bought. A timestamp (not a
  // remaining-duration counter) so the window keeps elapsing while the game is
  // closed — a "24h" booster that only ticks during play would never expire for
  // an occasional player.
  coinDoublerExpiresAt: null,
  // Which season the pass progress belongs to; null until first stamped.
  // When the rolling season advances past this, syncSeason() resets the pass.
  seasonKey: null,
  // Cloud save bookkeeping (src/lib/cloudSave.js): the server rev this save
  // was last in step with (0: never), the fingerprint of the save as it was
  // then (null: never), and when (epoch ms). A save whose own fingerprint
  // differs from cloudSyncedHash has changes the server has not got. Kept in
  // the save itself rather than beside it, so that whatever replaces the save
  // (bindToUser's wipe, an adopted server save) replaces these with it: a
  // wiped save that kept the last account's rev would look in step with that
  // account's server save, and overwrite it.
  cloudRev: 0,
  cloudSyncedHash: null,
  cloudSyncedAt: null,
};

/**
 * Every field a save holds, in initialState's order. The cloud save is built
 * from this list (minus the device's own settings and the bookkeeping above),
 * so a field added to initialState travels with the save without anyone
 * having to remember to add it.
 */
export const SAVE_FIELDS = Object.keys(initialState);

/** What a fresh save starts with, for the reset confirmation to compare against. */
export const STARTING_GEMS = initialState.gems;
export const FRESH_START = {
  gems: initialState.gems,
  coins: initialState.coins,
  cardIds: [...initialState.ownedCards],
  cardPacks: initialState.cardPacks,
};

/**
 * What "Reset All Progress" carries over: everything the player paid for, and
 * the ledgers that stop a reward being claimed twice. Settings words its
 * confirmation from this same object, so the copy cannot promise more or less
 * than the reset does.
 *
 * Paid for, so kept:
 *   - Gems, whole. Gems bought and gems earned are one balance and spending is
 *     not attributed, so keeping only "the bought share" would be a guess, and
 *     guessing wrong takes money. Spent gems are already gone, and the
 *     lastSyncedServerGems mark (kept by resetProgress) stops the next login
 *     crediting any purchase a second time. Never below the starting amount,
 *     which is what a reset always handed out, except while gems are owed.
 *   - Gems owed (gemDebt), whole: a reset that wiped them would turn a
 *     reversed payment's spent gems back into free ones, and it does not
 *     hand out the starting 10 against them either.
 *   - Unopened Premium and Legendary packs (sold for gems), an active Coin
 *     Doubler (sold for gems), and cosmetics (sold with the Premium Pass).
 *   - This season's Premium Pass. A pass stamped for an earlier season is
 *     already over, so it goes, as the rollover would have done.
 *
 * Ledgers, kept because gems now survive the reset: Battle Pass claims (both
 * tracks pay gems) and challenge claims (they pay gems and Legendary packs),
 * with the dates that scope them. Wiped, the same tiers and the same day's
 * challenges could be claimed again straight after the reset, and again after
 * the next one, minting gems from nothing. Season XP and the challenge
 * counters still reset: the tiers and challenges not yet claimed are earned
 * again from zero.
 */
export const keptThroughReset = (state, now = new Date()) => {
  const passIsCurrent = state.seasonKey === getCurrentSeason(now).key;
  const doublerRunning = typeof state.coinDoublerExpiresAt === 'number' && state.coinDoublerExpiresAt > now.getTime();
  const owed = state.gemDebt > 0 ? state.gemDebt : 0;
  return {
    gems: owed > 0 ? state.gems : Math.max(STARTING_GEMS, state.gems),
    gemDebt: owed,
    pendingGemCharges: Array.isArray(state.pendingGemCharges) ? state.pendingGemCharges : [],
    premiumPacks: state.premiumPacks,
    legendaryPacks: state.legendaryPacks,
    coinDoublerExpiresAt: doublerRunning ? state.coinDoublerExpiresAt : null,
    unlockedCosmetics: [...state.unlockedCosmetics],
    equippedCardBack: cardBackId(state.equippedCardBack),
    equippedBoard: boardId(state.equippedBoard),
    equippedFinish: finishId(state.equippedFinish),
    equippedAvatar: avatarId(state.equippedAvatar),
    equippedLine: lineId(state.equippedLine),
    claimedChallenges: [...state.claimedChallenges],
    dailyStatsDate: state.dailyStatsDate,
    weeklyStatsDate: state.weeklyStatsDate,
    ...(passIsCurrent ? {
      seasonKey: state.seasonKey,
      hasBattlePassPremium: state.hasBattlePassPremium,
      claimedBattlePassRewards: {
        free: [...state.claimedBattlePassRewards.free],
        premium: [...state.claimedBattlePassRewards.premium],
      },
    } : {}),
  };
};

/**
 * A save from anywhere (an earlier release's localStorage, or the server's
 * copy of this account's save) as a complete, well-formed one: fields added
 * later filled in, nested shapes repaired, corrupt numbers coerced. Without
 * this a returning player's stale save can crash on reads like
 * claimedBattlePassRewards.premium.includes(...) or surface NaN balances.
 * persist's migrate runs it on an old localStorage save; the cloud save runs
 * it on every server save before it replaces the local one.
 */
export const normalizeSave = (persisted) => {
  const s = { ...initialState, ...(persisted || {}) };

  s.claimedBattlePassRewards = {
    free: persisted?.claimedBattlePassRewards?.free ?? [],
    premium: persisted?.claimedBattlePassRewards?.premium ?? [],
  };
  s.unlockedCosmetics = Array.isArray(persisted?.unlockedCosmetics) ? persisted.unlockedCosmetics : [];
  s.equippedCardBack = cardBackId(persisted?.equippedCardBack);
  s.equippedBoard = boardId(persisted?.equippedBoard);
  s.equippedFinish = finishId(persisted?.equippedFinish);
  s.equippedAvatar = avatarId(persisted?.equippedAvatar);
  s.equippedLine = lineId(persisted?.equippedLine);
  s.hapticsEnabled = persisted?.hapticsEnabled === true;
  s.musicOn = persisted?.musicOn === true;
  s.audioMuted = persisted?.audioMuted === true;
  s.colorblindSafe = persisted?.colorblindSafe === true;
  s.musicVolume = clampVolume(persisted?.musicVolume, initialState.musicVolume);
  s.sfxVolume = clampVolume(persisted?.sfxVolume, initialState.sfxVolume);
  s.textSize = persisted?.textSize === 'large' || persisted?.textSize === 'larger'
    ? persisted.textSize
    : 'default';
  // Booster expiry is a nullable timestamp, so it can't join the
  // numeric-coercion sweep below (that would rewrite every inactive null).
  // Anything that isn't a finite number means "no booster running".
  s.coinDoublerExpiresAt = Number.isFinite(persisted?.coinDoublerExpiresAt)
    ? persisted.coinDoublerExpiresAt
    : null;
  s.claimedChallenges = Array.isArray(persisted?.claimedChallenges) ? persisted.claimedChallenges : [];
  // Pre-rollover saves have no season stamp — null means "stamp without
  // resetting" on the first syncSeason(), grandfathering their progress.
  s.seasonKey = typeof persisted?.seasonKey === 'string' ? persisted.seasonKey : null;
  s.ownedCards = Array.isArray(persisted?.ownedCards) && persisted.ownedCards.length
    ? persisted.ownedCards : [...initialState.ownedCards];
  s.currentDeck = Array.isArray(persisted?.currentDeck) ? persisted.currentDeck : [...initialState.currentDeck];
  s.savedDecks = Array.isArray(persisted?.savedDecks) ? persisted.savedDecks : [];
  s.completedAchievements = Array.isArray(persisted?.completedAchievements) ? persisted.completedAchievements : [];
  s.questRerolls = normalizeRerolls(persisted?.questRerolls);
  s.claimedSets = normalizeClaimedSets(persisted?.claimedSets);
  s.equippedTitle = titleById(persisted?.equippedTitle) ? persisted.equippedTitle : null;
  s.eventArmed = isEventId(persisted?.eventArmed) ? persisted.eventArmed : null;
  s.eventSpent = typeof persisted?.eventSpent === 'string' && persisted.eventSpent.length <= 80 ? persisted.eventSpent : null;
  s.cardStars = normalizeStars(persisted?.cardStars, ALL_CARDS.map((card) => card.id));
  s.claimedStarSets = normalizeClaimedSets(persisted?.claimedStarSets);
  s.crawlClaimedWeek = typeof persisted?.crawlClaimedWeek === 'string' ? persisted.crawlClaimedWeek : null;
  s.lastBattleDate = typeof persisted?.lastBattleDate === 'string' ? persisted.lastBattleDate : null;
  s.morningAfterDate = typeof persisted?.morningAfterDate === 'string' ? persisted.morningAfterDate : null;
  s.firstSeenDate = typeof persisted?.firstSeenDate === 'string' ? persisted.firstSeenDate : null;
  s.catchUpWeek = typeof persisted?.catchUpWeek === 'string' ? persisted.catchUpWeek : null;
  s.claimedLevelRewards = Array.isArray(persisted?.claimedLevelRewards)
    ? persisted.claimedLevelRewards.filter((level) => trackRow(level))
    : [];
  s.claimedPlaques = Array.isArray(persisted?.claimedPlaques)
    ? persisted.claimedPlaques.filter((id) => plaqueById(id))
    : [];
  const chapterIds = new Set(STORY_CHAPTERS.map((chapter) => chapter.id));
  s.claimedChapters = Array.isArray(persisted?.claimedChapters)
    ? persisted.claimedChapters.filter((id) => chapterIds.has(id))
    : [];
  // A save from before comeback wins were counted: the one-off achievement
  // means they have done it at least once. Only when the field is absent, so
  // a real zero stays zero.
  if (!persisted || !Object.prototype.hasOwnProperty.call(persisted, 'comebackWins')) {
    s.comebackWins = s.completedAchievements.includes('comeback') ? 1 : 0;
  }

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
    'legendaryPacks', 'weekWins', 'weekCoinsEarned', 'weekStreak', 'weekBestStreak', 'weekNewCards',
    'consecutiveLogins', 'totalWins', 'totalLosses', 'currentWinStreak', 'bestWinStreak',
    'lastSyncedServerGems', 'cloudRev', 'gemDebt', 'dailyStreak', 'dailyBest',
    'comebackWins', 'streakShields', 'weekBattles', 'weekDamage', 'weekCards',
    'packPity', 'packOpens', 'packCoinSpent', 'packCoinBack', 'sellbackToday',
    'earnedOpensToday', 'skipsToday', 'paidRerollsToday', 'crawlGateUntil']) {
    if (typeof s[k] !== 'number' || Number.isNaN(s[k])) s[k] = initialState[k];
  }
  s.comebackWins = Math.max(0, Math.floor(s.comebackWins));
  // One shield, or none. A forged 9 is still one.
  s.streakShields = s.streakShields >= 1 ? 1 : 0;
  s.instantOpen = persisted?.instantOpen === true;
  s.decksUnlocked = persisted?.decksUnlocked === true;
  s.storageUnlocked = persisted?.storageUnlocked === true;
  s.bonusDeckSlot = persisted?.bonusDeckSlot === true;
  s.firstConvenience = persisted?.firstConvenience === true;
  s.starterOfferDismissed = persisted?.starterOfferDismissed === true;
  s.crawlTimer = persisted?.crawlTimer === true;
  const dayish = (value) => (typeof value === 'string' && value.length > 0 && value.length < 48 ? value : null);
  s.sellbackDay = dayish(persisted?.sellbackDay);
  s.earnedOpensDay = dayish(persisted?.earnedOpensDay);
  s.packStreakDay = dayish(persisted?.packStreakDay);
  s.skipDay = dayish(persisted?.skipDay);
  s.shieldBoughtDay = dayish(persisted?.shieldBoughtDay);
  s.paidRerollDay = dayish(persisted?.paidRerollDay);
  s.crawlGatedStop = dayish(persisted?.crawlGatedStop);
  // A debt is a count of gems: never negative, which would be a credit.
  s.gemDebt = Math.max(0, s.gemDebt);
  s.pendingGemCharges = Array.isArray(persisted?.pendingGemCharges)
    ? persisted.pendingGemCharges.filter((n) => typeof n === 'number' && n > 0 && n < 100000).slice(0, 20)
    : [];
  // The sync bookkeeping is nullable like the booster's expiry: anything
  // malformed means "never in step", which at worst sends the save again.
  s.cloudSyncedHash = typeof persisted?.cloudSyncedHash === 'string' ? persisted.cloudSyncedHash : null;
  s.cloudSyncedAt = Number.isFinite(persisted?.cloudSyncedAt) ? persisted.cloudSyncedAt : null;
  // musicEnabled was a Settings switch nothing ever read. Drop it so a v3
  // save cannot write the dead field back on the next persist.
  delete s.musicEnabled;
  s.dailyKey = typeof persisted?.dailyKey === 'string' ? persisted.dailyKey : null;
  s.dailyResult = persisted?.dailyResult === 'win' || persisted?.dailyResult === 'loss' ? persisted.dailyResult : null;
  // The first-fight lesson. Absent on an older save: anyone who has already
  // fought has had their onboarding, and is not sat through it again.
  if (!persisted || !Object.prototype.hasOwnProperty.call(persisted, 'firstFightSeen')) {
    s.firstFightSeen = (Number(persisted?.totalBattles) || 0) > 0;
  } else {
    s.firstFightSeen = persisted.firstFightSeen === true;
  }
  return s;
};

/**
 * The patch that adds `amount` gems to `state`: what is owed (gemDebt) is
 * paid first, and only the rest reaches the balance. Every way gems come in
 * goes through this (a purchase or a won dispute through the reconcile,
 * challenge, Battle Pass and login rewards), so a debt cannot be skipped by
 * earning gems another way.
 */
export const creditGems = (state, amount) => {
  const n = Math.max(0, Number(amount) || 0);
  const owed = state.gemDebt > 0 ? state.gemDebt : 0;
  const pay = Math.min(owed, n);
  return { gems: state.gems + n - pay, gemDebt: owed - pay };
};

// Which pending convenience spends add up to a server drop. Null when the
// drop is not one of those spends (a chargeback, or a mix this cannot see).
const consumePendingCharges = (pending, drop) => {
  const amounts = (Array.isArray(pending) ? pending : []).filter((n) => typeof n === 'number' && n > 0);
  if (amounts.length === 0 || drop <= 0 || amounts.length > 20) return null;
  const reach = new Map([[0, 0]]);
  for (let i = 0; i < amounts.length; i += 1) {
    const entries = [...reach.entries()];
    for (const [sum, mask] of entries) {
      const next = sum + amounts[i];
      if (next > drop || reach.has(next)) continue;
      reach.set(next, mask | (1 << i));
    }
  }
  if (!reach.has(drop)) return null;
  const mask = reach.get(drop);
  return { left: amounts.filter((_, i) => (mask & (1 << i)) === 0) };
};

// How the last server credit on this page was split between what was owed
// and the balance (reconcileServerGems writes it). Outside the store's
// state on purpose: it is about this page only, so it persists nowhere and
// goes to no cloud save.
let lastServerCredit = null;

/**
 * How the credit that brought `serverBalance` onto this device was split:
 * `{ toDebt, toBalance }`, or null when no credit on this page did. For the
 * screens that announce a purchase. With gems owed, "550 gems added" over a
 * counter that rose by 10 reads as a purchase that never arrived. Asked by
 * balance rather than taken from the caller's own reconcile, because App's
 * login sync often credits the purchase first, and the caller's reconcile
 * then finds nothing left to add.
 */
export const serverCreditAt = (serverBalance) => {
  const c = lastServerCredit;
  if (!c || c.serverBalance !== serverBalance) return null;
  // A credit read for another account's save says nothing about this one.
  if (c.ownerUserId !== useGameStore.getState().ownerUserId) return null;
  return { toDebt: c.toDebt, toBalance: c.toBalance };
};

// The store's own state and actions, held apart from persistence so that
// scratchGameStore (below) can run them on a save that is not the one in play.
let gameState = null;
const keepGameState = (creator) => {
  gameState = creator;
  return creator;
};

const scriptedPack = (size) => {
  const queue = globalThis.__TEDDIES_PACK_SCRIPT;
  if (!Array.isArray(queue) || queue.length < size) return null;
  const cards = queue.slice(0, size).map((id) => ALL_CARDS.find((card) => card.id === id));
  if (cards.some((card) => !card)) return null;
  globalThis.__TEDDIES_PACK_SCRIPT = queue.slice(size);
  return cards;
};

export const useGameStore = create(
  persist(
    keepGameState((set, get) => ({
      ...initialState,

      // Not persisted — populated only in the current session
      pendingAchievements: [],

      // Not persisted either: what a season's end delivered (see syncSeason),
      // waiting for App to say so.
      pendingSeasonDeliveries: [],

      setPlayerName: (name) => set({ playerName: name }),

      // Not persisted either: level-ups waiting to be announced. App toasts
      // them, except while the battle screen is up — the game-over panel shows
      // its own, and takes them off this queue (dismissLevelUp) as it does.
      pendingLevelUps: [],

      // Returns what changed, so a caller can show it: the level and XP before
      // and after, each level's XP need (the progress bar's denominators), the
      // coin bonus the level-ups paid, the season XP either side (the Battle
      // Pass tier), and the id of the queued announcement, if any. Level-ups
      // used to happen silently — 100 × the new level in coins credited with
      // no word to the player anywhere.
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

        const levelsGained = newLevel - state.level;
        const levelUp = levelsGained > 0
          ? { id: ++levelUpSeq, level: newLevel, levelsGained, bonusCoins }
          : null;
        set((s) => ({
          xp: newXP,
          level: newLevel,
          seasonXP: state.seasonXP + amount,
          coins: state.coins + bonusCoins,
          ...(levelUp ? { pendingLevelUps: [...s.pendingLevelUps, levelUp] } : {}),
        }));
        // One event per level reached, so a jump of two still counts both.
        for (let lvl = state.level + 1; lvl <= newLevel; lvl++) analytics.trackLevelUp(lvl);
        get().checkAchievement('level_10', newLevel >= 10);
        get().checkAchievement('level_25', newLevel >= 25);
        get().checkAchievement('level_50', newLevel >= 50);

        return {
          levelBefore: state.level,
          xpBefore: state.xp,
          xpNeededBefore: getXPForLevel(state.level),
          levelAfter: newLevel,
          xpAfter: newXP,
          xpNeededAfter: getXPForLevel(newLevel),
          levelsGained,
          bonusCoins,
          seasonXPBefore: state.seasonXP,
          seasonXPAfter: state.seasonXP + amount,
          levelUpId: levelUp?.id ?? null,
        };
      },

      // Take an announcement off the queue because the caller has shown it.
      dismissLevelUp: (id) => {
        if (id == null) return;
        set((s) => ({ pendingLevelUps: s.pendingLevelUps.filter((l) => l.id !== id) }));
      },

      getXPForNextLevel: () => getXPForLevel(get().level),

      // Cumulative experience in the leaderboard's flat 100-per-level scale, so
      // a rival row's calculateLevel() (floor(experience/100)+1 in
      // Leaderboard.jsx) reproduces this player's true store level. The store's
      // own `xp` is within-level on a 1.5^level curve, which the flat leaderboard
      // formula can't read directly — writing it raw left every rival computing
      // Level 1. Capped just under 10000 to match sync_player_level's clamp.
      getLeaderboardExperience: () => {
        const { level, xp } = get();
        const within = Math.min(99, Math.floor((100 * xp) / getXPForLevel(level)));
        return Math.min(9999, (level - 1) * 100 + within);
      },

      addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
      spendCoins: (amount) => {
        const state = get();
        if (state.coins >= amount) {
          set({ coins: state.coins - amount });
          return true;
        }
        return false;
      },

      // Pays any gems owed first (creditGems).
      addGems: (amount) => set((state) => creditGems(state, amount)),
      setGems: (amount) => set({ gems: amount }),

      // Credit only newly-purchased gems (the amount the authoritative server
      // balance has risen since we last synced), then advance the high-water
      // mark. Re-reading the server balance after spending therefore can't
      // restore spent gems, while purchases made on another device still land.
      // Claim this save for `userId`, wiping it first if it belongs to someone
      // else. Must run BEFORE reconcileServerGems on login.
      //
      // The bug this closes: the store persists to a single device-wide key with
      // no user scoping, and signing out clears nothing. A second account on the
      // same device therefore inherited the first player's progress and, worse,
      // their lastSyncedServerGems mark. reconcileServerGems credits
      // `serverBalance - lastSyncedServerGems`, so if player A had synced 500 and
      // player B then bought 500 gems, B's delta was 500 - 500 = 0: B paid real
      // money and received nothing. Preserving the mark across resetProgress
      // (correct on its own, it stops purchases being re-credited) made that
      // state unrecoverable from inside the app.
      //
      // A null owner means a save from before this existed — claim it rather
      // than wiping it, so existing players keep their progress.
      bindToUser: (userId) => {
        if (!userId) return;                       // signed out: keep state for their return
        const state = get();
        if (state.ownerUserId === userId) return;  // same player, nothing to do
        if (state.ownerUserId === null) {
          set({ ownerUserId: userId });            // adopt a pre-existing save
          return;
        }
        set({ ...initialState, ownerUserId: userId, pendingAchievements: [], pendingLevelUps: [], pendingSeasonDeliveries: [] });
      },
      // `forUserId` is the account the balance was READ for. When given, it
      // must still match the account the save is bound to, or the reconcile is
      // dropped.
      //
      // The race this closes is the shared-device one bindToUser exists for,
      // arriving through the async tail. A's balance request is in flight when
      // A signs out and B signs in; bindToUser(B) wipes the save and zeroes the
      // mark; A's response then resolves and, unguarded, credits B with the
      // gems A paid for AND sets B's mark to A's total — so B's own next
      // purchase computes a delta of zero and credits nothing. That is exactly
      // the "paid real money and received nothing" failure the bindToUser
      // comment above says must not happen.
      //
      // Checked here rather than in the caller because this store is what knows
      // who owns the save, and it is the only place all callers pass through.
      reconcileServerGems: (serverBalance, forUserId = null) => {
        if (typeof serverBalance !== 'number' || Number.isNaN(serverBalance)) return;
        const state = get();
        if (forUserId && state.ownerUserId && state.ownerUserId !== forUserId) return;
        const delta = serverBalance - state.lastSyncedServerGems;
        if (delta > 0) {
          // A purchase, or a reversal undone (a dispute won): it pays off
          // whatever an earlier reversal left owed before it adds anything.
          const credit = creditGems(state, delta);
          const toBalance = credit.gems - state.gems;
          lastServerCredit = {
            serverBalance, ownerUserId: state.ownerUserId, toDebt: delta - toBalance, toBalance,
          };
          // The first time bought gems land, the house adds one saved-deck
          // slot. It is a shelf, not a card.
          const bonus = state.firstConvenience ? {} : { firstConvenience: true, bonusDeckSlot: true };
          set({ ...credit, ...bonus, lastSyncedServerGems: serverBalance });
        } else if (delta < 0) {
          // A drop that matches convenience spends whose receipt never came
          // back is the server applying those spends, not a chargeback.
          const drop = -delta;
          const pending = Array.isArray(state.pendingGemCharges) ? state.pendingGemCharges : [];
          const usable = consumePendingCharges(pending, drop);
          if (usable) {
            set({ pendingGemCharges: usable.left, lastSyncedServerGems: serverBalance });
          } else {
            const after = state.gems + delta;
            const owed = state.gemDebt > 0 ? state.gemDebt : 0;
            set({
              gems: Math.max(0, after),
              gemDebt: owed + Math.max(0, -after),
              lastSyncedServerGems: serverBalance,
            });
          }
        }
      },
      // A convenience purchase already took the gems locally, and the server
      // took the same gems from user_gems. Move the high-water mark to that
      // balance so the next reconcile does not read the drop as a chargeback
      // and take them a second time.
      noteServerGemSpend: (balance) => {
        if (typeof balance !== 'number' || Number.isNaN(balance)) return;
        set({ lastSyncedServerGems: balance });
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
      // progress, claims, and premium are per-season. What it unlocked
      // (cosmetics, cards) is not, and every tier the player reached but did
      // not claim is delivered before the reset rather than dropped: they
      // used to be forfeited without a word. Returns that delivery (and
      // queues it on pendingSeasonDeliveries for App to announce), or null.
      syncSeason: () => {
        const { key } = getCurrentSeason();
        const state = get();
        if (state.seasonKey === key) return null;
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
            return null;
          }
          // fall through: legacy Season-1 progress in a later season → reset
        }
        // The season this save's pass belongs to (an un-stamped legacy save's
        // is the original Season 1), and what it still owes: every tile it
        // could claim right now, by the same rule the dialog offers them by.
        // One season's worth however many were skipped: the save only ever
        // holds the pass it was last played in.
        const ended = seasonFromKey(state.seasonKey) ?? getSeason(1);
        const owed = readyRewards(passOf(state));
        // Stamp the new season BEFORE handing anything over. The grants below
        // write through other actions, and a second call (StrictMode's second
        // effect pass, another screen mounting in the same tick) has to find
        // the rollover done, not deliver it again.
        set({
          seasonKey: key,
          seasonXP: 0,
          claimedBattlePassRewards: { free: [], premium: [] },
          hasBattlePassPremium: false,
        });
        if (owed.length === 0) return null;
        const receipts = owed.map(({ tier, track, reward }) => ({ tier, track, reward, ...get().grantReward(reward) }));
        const delivery = { id: ++deliverySeq, season: ended.name, receipts, summary: describeGrants(receipts) };
        // A delivery of nothing new (only cosmetics already owned) is not news.
        if (delivery.summary) {
          set((s) => ({ pendingSeasonDeliveries: [...s.pendingSeasonDeliveries, delivery] }));
        }
        return delivery;
      },

      // Take a delivery off the queue because the caller has announced it.
      dismissSeasonDelivery: (id) => {
        if (id == null) return;
        set((s) => ({ pendingSeasonDeliveries: s.pendingSeasonDeliveries.filter((d) => d.id !== id) }));
      },

      // Roll the season first so a purchase right at a quarter boundary (or
      // from a dialog held open across it) lands in the season the player is
      // actually buying — not stamped onto the expired one and wiped moments
      // later.
      setBattlePassPremium: (value) => {
        get().syncSeason();
        set({ hasBattlePassPremium: value });
      },
      // Atomic buy: check ownership and debit in one store-side step, matching
      // claimBattlePassReward's "don't trust the component's render" rule.
      //
      // Split across the component as `if (spendGems(price)) setBattlePassPremium(true)`
      // this double-charges. Both handlers read `hasBattlePassPremium` from the
      // same render closure, so two clicks landing before React re-renders each
      // see `false`, and spendGems reads live store state — so a player holding
      // 1000 gems pays twice for one pass. Reading ownership through get() here
      // means the second call sees the first call's write and bails.
      purchaseBattlePassPremium: (price) => {
        get().syncSeason();
        const state = get();
        if (state.hasBattlePassPremium) return 'already-owned';
        if (state.gems < price) return 'insufficient-gems';
        set({ gems: state.gems - price, hasBattlePassPremium: true });
        return 'purchased';
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

      // Claim one Battle Pass tile and hand its reward over, in one step.
      // Eligibility comes from the reward table and the store, never from the
      // caller's render: the tier reached, the pass owned for the premium
      // track, the tile not already claimed (claimBattlePassReward records
      // it atomically, so a double tap cannot pay twice). Returns
      // { ok: true, tier, track, reward, ...receipt } — the receipt says what
      // was really handed over (see grantReward) — or { ok: false, reason }.
      claimBattlePassTier: (tier, track) => {
        const row = BATTLE_PASS_REWARDS.find((r) => r.tier === tier);
        const reward = row?.[track];
        if (!reward) return { ok: false, reason: 'unknown' };
        get().syncSeason();
        const state = get();
        if (state.seasonXP < row.xpRequired) return { ok: false, reason: 'not-reached' };
        if (track === 'premium' && !state.hasBattlePassPremium) return { ok: false, reason: 'needs-premium' };
        if (!get().claimBattlePassReward(tier, track === 'premium', row.xpRequired)) {
          return { ok: false, reason: 'already-claimed' };
        }
        return { ok: true, tier, track, reward, ...get().grantReward(reward) };
      },

      // Hand one Battle Pass reward over, and say what was really handed
      // over: a card the player already owns pays its duplicate coins instead
      // (addCards' rule), so its receipt says alreadyOwned and the coins; a
      // cosmetic already owned is not granted twice. The claim's toast and a
      // season's delivery are worded from this, not from the table — the
      // pass used to toast "Card Unlocked!" for a card that had turned into
      // coins.
      grantReward: (reward) => {
        switch (reward?.type) {
          case 'coins':
            get().addCoins(reward.amount);
            return { coins: reward.amount };
          case 'gems':
            get().addGems(reward.amount);
            return { gems: reward.amount };
          case 'pack':
            get().addCardPack(reward.amount);
            return { packs: reward.amount };
          case 'card': {
            const card = { id: reward.cardId, name: reward.name };
            const dupeCoins = get().addCard(reward.cardId);
            return dupeCoins > 0 ? { card, alreadyOwned: true, coins: dupeCoins } : { card };
          }
          case 'exclusive': {
            const alreadyOwned = get().unlockedCosmetics.includes(reward.name);
            get().unlockCosmetic(reward.name);
            return { cosmetic: reward.name, ...(alreadyOwned ? { alreadyOwned } : {}) };
          }
          default:
            return {};
        }
      },

      // Record a cosmetic entitlement (idempotent). The Battle Pass 'exclusive'
      // tiers grant borders/emotes; storing the name here makes the claim a real
      // grant rather than a no-op.
      unlockCosmetic: (name) => {
        if (!name) return;
        const state = get();
        if (state.unlockedCosmetics.includes(name)) return;
        set({ unlockedCosmetics: [...state.unlockedCosmetics, name] });
      },

      // Buy a card back or a table cloth with coins or gems already held, or
      // put on one the player already owns. The quote is the whole decision
      // (src/lib/wardrobe.js); applying it is one write, so a second tap sees
      // the first. Gems are real money: the wardrobe confirms those before
      // it calls this. Returns the quote's reason, or 'unknown'.
      purchaseWardrobe: (id) => {
        const quote = quoteWardrobe(get(), id);
        if (!quote.ok) return quote.reason;
        set(quote.patch);
        return quote.reason;
      },

      addCard: (cardId) => get().addCards([cardId]),

      // Grant cards: new ids are added to the collection, duplicates are refunded
      // as coins so a pull is never worthless. Returns the coins awarded.
      addCards: (cardIds) => {
        // Roll the week over first, so cards collected after a week boundary
        // count toward the NEW week's "Collect N New Cards" — not the old one,
        // which would leave the counter stuck high and the challenge re-claimable.
        get().syncPeriods();
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
        const state = get();
        const cap = deckSlotsFor(state.totalWins || 0, state.decksUnlocked === true, state.bonusDeckSlot === true);
        const replacing = state.savedDecks.some((deck) => deck.name === name);
        if (!replacing && state.savedDecks.length >= cap) return false;
        set((s) => ({
          savedDecks: [...s.savedDecks.filter(d => d.name !== name), { name, cards: cardIds }]
        }));
        return true;
      },

      deleteDeck: (name) => {
        set((state) => ({
          savedDecks: state.savedDecks.filter(d => d.name !== name)
        }));
      },

      // damageTaken defaults to 0 so existing 5-arg callers keep working; the
      // battle board passes the real figure, which is what 'Flawless' needs.
      recordBattleResult: (won, damageDealt = 0, healingDone = 0, finalHP = 0, cardsPlayed = 0, damageTaken = 0) => {
        const state = get();

        // All-time counters
        const newWins = won ? state.totalWins + 1 : state.totalWins;
        const newLosses = won ? state.totalLosses : state.totalLosses + 1;
        const newStreak = won ? state.currentWinStreak + 1 : 0;
        const newBestStreak = Math.max(state.bestWinStreak, newStreak);
        const newTotalDamage = state.totalDamageDealt + damageDealt;
        const newTotalHealing = state.totalHealingDone + healingDone;
        const newTotalBattles = state.totalBattles + 1;

        // Coins earned this battle (also drives the weekly coins challenge).
        // The Coin Doubler booster multiplies the payout while its window is
        // open; the doubled figure is the real grant, so it is what the weekly
        // total counts too.
        const baseCoins = won ? 25 + (newStreak * 5) : 5;
        const doublerActive = typeof state.coinDoublerExpiresAt === 'number'
          && state.coinDoublerExpiresAt > Date.now();
        const now = new Date();
        const today = now.toDateString();
        // An armed night pays on this one fight, then it is spent. A stale
        // arm (the hour ended) is dropped and does not pay.
        let coinsThisBattle = doublerActive ? baseCoins * 2 : baseCoins;
        let eventApplied = null;
        let nextArmed = state.eventArmed || null;
        let nextSpent = state.eventSpent || null;
        if (nextArmed) {
          const live = eventAt(now);
          if (live && live.id === nextArmed && nextSpent !== eventSpentKey(now, live.id)) {
            coinsThisBattle = scaleReward(coinsThisBattle, live.coins, live.coinsDen);
            eventApplied = live;
            nextArmed = null;
            nextSpent = eventSpentKey(now, live.id);
          } else {
            nextArmed = null;
          }
        }

        // Daily stats — auto-reset when the calendar date changes
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
        // weekly progress. Track a week-scoped running streak (resets on the
        // Monday rollover and on a loss) rather than folding in the all-time
        // currentWinStreak: a streak carried over from last week would otherwise
        // satisfy the weekly streak challenge after a single win, making its pack
        // rewards re-claimable every week for one game.
        const priorWeekStreak = weeklyReset ? 0 : (state.weekStreak ?? 0);
        const newWeekStreak = won ? priorWeekStreak + 1 : 0;
        const newWeekBestStreak = Math.max(weeklyReset ? 0 : state.weekBestStreak, newWeekStreak);
        const newWeekBattles = (weeklyReset ? 0 : (state.weekBattles || 0)) + 1;
        const newWeekDamage = (weeklyReset ? 0 : (state.weekDamage || 0)) + Math.max(0, damageDealt || 0);
        const newWeekCards = (weeklyReset ? 0 : (state.weekCards || 0)) + Math.max(0, cardsPlayed || 0);
        const comebackWin = Boolean(won) && finalHP <= LAST_CALL_HP;
        const newComebacks = (state.comebackWins || 0) + (comebackWin ? 1 : 0);

        // Clear claimed challenges for any period that just rolled over, so the
        // same daily/weekly challenge ids become claimable again. Challenge ids
        // are prefixed 'd' (daily) or 'w' (weekly).
        let newClaimedChallenges = state.claimedChallenges;
        if (dailyReset) newClaimedChallenges = newClaimedChallenges.filter(id => !id.startsWith('d'));
        if (weeklyReset) newClaimedChallenges = newClaimedChallenges.filter(id => !id.startsWith('w'));

        const beforeCrawl = crawlStatus(state, weekKey);
        const afterCrawl = crawlStatus({
          ...state,
          totalBattles: newTotalBattles,
          weekBattles: newWeekBattles,
          weekWins: newWeekWins,
          weekDamage: newWeekDamage,
          weekCards: newWeekCards,
        }, weekKey);
        const newlyMet = afterCrawl.stops.find((stop, i) => stop.met && !beforeCrawl.stops[i].met);
        let nextTimer = state.crawlTimer === true;
        let nextGate = state.crawlGateUntil || 0;
        let nextGated = state.crawlGatedStop || null;
        if (weeklyReset) {
          nextTimer = true;
          nextGate = 0;
          nextGated = null;
        }
        if (nextTimer && newlyMet && nextGate <= Date.now()) {
          nextGate = Date.now() + CRAWL_STOP_WAIT_MS;
          nextGated = newlyMet.id;
        }

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
          weekStreak: newWeekStreak,
          weekBestStreak: newWeekBestStreak,
          weekNewCards: weeklyReset ? 0 : state.weekNewCards,
          weekBattles: newWeekBattles,
          weekDamage: newWeekDamage,
          weekCards: newWeekCards,
          weeklyStatsDate: weekKey,
          comebackWins: newComebacks,
          lastBattleDate: today,
          eventArmed: nextArmed,
          eventSpent: nextSpent,
          // Re-claimable challenges after a period rollover
          claimedChallenges: newClaimedChallenges,
          crawlTimer: nextTimer,
          crawlGateUntil: nextGate,
          crawlGatedStop: nextGated,
        });

        const baseXp = won ? BATTLE_XP.win : BATTLE_XP.loss;
        const xpGain = eventApplied ? scaleReward(baseXp, eventApplied.xp, eventApplied.xpDen) : baseXp;
        const progress = get().addXP(xpGain);
        // One grant for both outcomes — coinsThisBattle already encodes the
        // consolation amount on a loss. Granting a separate hardcoded 5 there
        // would drift from the figure weekCoinsEarned tracks the moment any
        // multiplier (like the Coin Doubler) applies.
        get().addCoins(coinsThisBattle);
        if (won) syncPackWin().catch(() => {});

        get().checkAchievement('first_win', newWins >= 1);
        get().checkAchievement('win_10', newWins >= 10);
        get().checkAchievement('win_50', newWins >= 50);
        get().checkAchievement('win_streak_5', newStreak >= 5);
        get().checkAchievement('win_streak_10', newStreak >= 10);
        get().checkAchievement('win_100', newWins >= 100);
        get().checkAchievement('play_100', newTotalBattles >= 100);
        get().checkAchievement('deal_1000_damage', newTotalDamage >= 1000);
        get().checkAchievement('heal_500', newTotalHealing >= 500);
        // 'Flawless' is "Win without losing HP", so it must key off damage
        // actually taken. finalHP === 30 alone is wrong: heal caps at 30, so a
        // player who got hit and healed back finished at full and claimed it.
        get().checkAchievement('perfect_win', won && finalHP === 30 && damageTaken === 0);
        get().checkAchievement('comeback', comebackWin);
        get().checkAchievement('comeback_3', newComebacks >= 3);

        // `progress` is addXP's account of the XP (level, bar, bonus coins,
        // season XP), for the game-over panel.
        return { xpGain, coinsGain: coinsThisBattle, progress, event: eventApplied ? eventApplied.id : null };
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

        // A null stamp means "never anchored to a period" — stamp it to now
        // WITHOUT resetting, grandfathering current progress. A non-null stamp
        // that no longer matches is a genuine rollover: reset that period.
        //
        // Stamping on null (rather than early-returning) is the fix for a
        // free-gems path: weekNewCards is bumped by addCards, but a player who
        // only collects cards and never battles had weeklyStatsDate stuck at
        // null forever, so syncPeriods early-returned and the counter never
        // reset across real week boundaries — leaving "Collect N New Cards"
        // permanently satisfied and re-claimable every rotation.
        const dailyReset = state.dailyStatsDate !== null && state.dailyStatsDate !== today;
        const weeklyReset = state.weeklyStatsDate !== null && state.weeklyStatsDate !== weekKey;
        const dailyStamp = state.dailyStatsDate === null;
        const weeklyStamp = state.weeklyStatsDate === null;
        if (!dailyReset && !weeklyReset && !dailyStamp && !weeklyStamp) return;

        let claimed = state.claimedChallenges;
        const patch = {};
        if (dailyReset) {
          claimed = claimed.filter(id => !id.startsWith('d'));
          Object.assign(patch, {
            todayWins: 0, todayBattles: 0, todayDamageDealt: 0, todayCardsPlayed: 0,
            dailyStatsDate: today,
          });
        } else if (dailyStamp) {
          patch.dailyStatsDate = today; // first anchor, keep progress
        }
        if (weeklyReset) {
          claimed = claimed.filter(id => !id.startsWith('w'));
          Object.assign(patch, {
            weekWins: 0, weekCoinsEarned: 0, weekStreak: 0, weekBestStreak: 0, weekNewCards: 0,
            weekBattles: 0, weekDamage: 0, weekCards: 0,
            weeklyStatsDate: weekKey,
          });
        } else if (weeklyStamp) {
          patch.weeklyStatsDate = weekKey; // first anchor, keep progress
        }
        set({ ...patch, claimedChallenges: claimed });
      },

      checkDailyLogin: () => {
        const state = get();
        const now = new Date();
        const today = now.toDateString();
        if (state.lastLoginDate === today) return null;

        const resolution = resolveLogin(state, now, DAILY_REWARDS.length);
        const { day, streak: newConsecutive } = resolution;
        const dayIndex = day - 1;
        const reward = DAILY_REWARDS[dayIndex];
        // The table is the day's rate. A long bender adds a percentage of it,
        // and an absence of three nights or more adds the comeback tab. Both
        // are part of this one claim, so neither can be taken twice.
        const bonusCoins = weekCoinBonus(reward.coins, newConsecutive);
        const comeback = resolution.usedShield ? null : comebackFor(resolution.gap);
        const plaqueCoins = plaqueBonus(state.claimedPlaques);
        const extraCoins = bonusCoins + (comeback?.coins || 0) + plaqueCoins;
        const extraPacks = comeback?.packs || 0;

        set({
          lastLoginDate: today,
          consecutiveLogins: newConsecutive,
          streakShields: resolution.shields,
          coins: state.coins + reward.coins + extraCoins,
          ...creditGems(state, reward.gems || 0),
          cardPacks: state.cardPacks + reward.packs + extraPacks,
          ...(state.firstSeenDate ? {} : { firstSeenDate: today }),
        });

        // Track what was ACTUALLY handed over, not what the table promised.
        // Card rewards can only draw from cards the player doesn't own, so a
        // full (or nearly full) collection converts the shortfall to coins —
        // and the claim panel renders whatever comes back from here. Returning
        // the untouched reward made it announce "+3 cards" to a player who
        // received none of them.
        let grantedCards = 0;
        let substituteCoins = 0;
        // Which cards, not only how many: the panel shows them. It used to
        // get a count, so a day that handed over a rare said "+1" and never
        // which card it was.
        let cardIds = [];
        if (reward.cards > 0) {
          const availableCards = ALL_CARDS.filter(c => !state.ownedCards.includes(c.id));
          const randomCards = shuffleDeck(availableCards)
            .slice(0, reward.cards)
            .map(c => c.id);
          if (randomCards.length > 0) get().addCards(randomCards);
          grantedCards = randomCards.length;
          cardIds = randomCards;
          // Collection complete (or nearly): honor the promised cards as coins
          // so the daily reward is never silently empty.
          const shortfall = reward.cards - grantedCards;
          if (shortfall > 0) {
            substituteCoins = shortfall * 50;
            get().addCoins(substituteCoins);
          }
        }

        get().checkAchievement('daily_7', newConsecutive >= 7);
        get().checkAchievement('daily_30', newConsecutive >= 30);
        return {
          ...reward,
          cards: grantedCards,
          cardIds,
          coins: reward.coins + extraCoins + substituteCoins,
          packs: reward.packs + extraPacks,
          substitutedCards: reward.cards - grantedCards,
          day: dayIndex + 1,
          consecutive: newConsecutive,
          bonusCoins,
          plaqueCoins,
          comeback,
          usedShield: resolution.usedShield,
          shieldRefilled: resolution.shieldRefilled,
          shields: resolution.shields,
        };
      },

      // Swap one unfinished, unclaimed quest for another from the same pool.
      // One a day, one a week. Returns the swap, or null when it is refused.
      rerollQuest: (period, fromId) => {
        const next = rerollPatch(get(), period, fromId, new Date());
        if (!next) return null;
        set({ questRerolls: next });
        return period === 'weekly' ? next.weeklySwap : next.dailySwap;
      },

      // The collection book's reward for owning every card of one rarity.
      // Coins and ordinary packs only: a premium or legendary pack would
      // survive a reset while the claim ledger would not, and mint another.
      claimCollectionSet: (setId) => {
        const state = get();
        const row = bookOf(ALL_CARDS, state.ownedCards).find((set) => set.id === setId);
        if (!row?.complete) return null;
        if (state.claimedSets.includes(setId)) return null;
        set({ claimedSets: [...state.claimedSets, setId] });
        if (row.reward.coins) {
          get().addCoins(row.reward.coins);
          set((s) => ({ packCoinBack: (s.packCoinBack || 0) + row.reward.coins }));
        }
        if (row.reward.packs) get().addCardPack(row.reward.packs);
        return { ...row.reward };
      },

      // Wear a title the player has earned, or null to take it off. The
      // account mirror is the caller's (setHouseTitle); this is the save.
      equipTitle: (id) => {
        if (id == null || id === '') {
          set({ equippedTitle: null });
          return null;
        }
        const title = titleById(id);
        if (!title) return false;
        if (!get().completedAchievements.includes(title.achievementId)) return false;
        set({ equippedTitle: id });
        return id;
      },

      // Say you are in for tonight's limited night. One fight spends it.
      armHouseEvent: () => {
        const now = new Date();
        const live = eventAt(now);
        if (!live) return null;
        const state = get();
        if (state.eventSpent === eventSpentKey(now, live.id)) return null;
        if (state.eventArmed === live.id) return live;
        set({ eventArmed: live.id });
        return live;
      },

      claimBarCrawl: () => {
        get().syncPeriods();
        const state = get();
        if ((state.totalBattles || 0) < CRAWL_UNLOCK_BATTLES) return null;
        const key = weekKeyOf(new Date());
        const status = crawlBoard(state, new Date());
        if (!status.done || status.claimed || status.waiting) return null;
        set({ crawlClaimedWeek: key });
        if (status.reward.coins) get().addCoins(status.reward.coins);
        if (status.reward.packs) get().addCardPack(status.reward.packs);
        return { ...status.reward };
      },

      skipCrawlTimer: () => {
        const state = get();
        const now = new Date();
        const today = now.toDateString();
        const board = crawlBoard(state, now);
        if (!board.waiting) return { ok: false, reason: 'clear' };
        const skips = state.skipDay === today ? state.skipsToday : 0;
        if (skips >= CRAWL_SKIPS_PER_DAY) return { ok: false, reason: 'cap' };
        if (state.gems < board.skipGems) return { ok: false, reason: 'short' };
        set({
          gems: state.gems - board.skipGems,
          crawlGateUntil: 0,
          skipDay: today,
          skipsToday: skips + 1,
          pendingGemCharges: [...(state.pendingGemCharges || []), board.skipGems].slice(-20),
        });
        syncConvenience(`crawl-${today}-${skips}`, 'crawl_skip')
          .then((data) => get().adoptConvenienceReceipt(data, board.skipGems))
          .catch(() => {});
        return { ok: true, gems: board.skipGems };
      },

      buyConvenience: (id) => {
        const item = convenienceById(id);
        if (!item) return { ok: false, reason: 'unknown' };
        const state = get();
        const today = new Date().toDateString();
        if (state.gems < item.gems) return { ok: false, reason: 'short' };
        if (id === 'instant_open') {
          if (state.instantOpen) return { ok: false, reason: 'owned' };
          set({
            gems: state.gems - item.gems,
            instantOpen: true,
            pendingGemCharges: [...(state.pendingGemCharges || []), item.gems].slice(-20),
          });
        } else if (id === 'deck_slots') {
          if (state.decksUnlocked) return { ok: false, reason: 'owned' };
          set({
            gems: state.gems - item.gems,
            decksUnlocked: true,
            pendingGemCharges: [...(state.pendingGemCharges || []), item.gems].slice(-20),
          });
        } else if (id === 'storage') {
          if (state.storageUnlocked) return { ok: false, reason: 'owned' };
          set({
            gems: state.gems - item.gems,
            storageUnlocked: true,
            pendingGemCharges: [...(state.pendingGemCharges || []), item.gems].slice(-20),
          });
        } else if (id === 'streak_shield') {
          if (state.streakShields >= 1) return { ok: false, reason: 'full' };
          if (state.shieldBoughtDay === today) return { ok: false, reason: 'cap' };
          set({
            gems: state.gems - item.gems,
            streakShields: 1,
            shieldBoughtDay: today,
            pendingGemCharges: [...(state.pendingGemCharges || []), item.gems].slice(-20),
          });
        } else {
          return { ok: false, reason: 'unknown' };
        }
        syncConvenience(`${id}-${today}`, id)
          .then((data) => get().adoptConvenienceReceipt(data, item.gems))
          .catch(() => {});
        return { ok: true };
      },

      // A reroll past the free one. Same swap the free reroll would make.
      // Three a day, priced in gems, and it does not change the quest's reward.
      buyQuestReroll: (period, fromId) => {
        const state = get();
        const today = new Date().toDateString();
        const used = state.paidRerollDay === today ? state.paidRerollsToday : 0;
        if (used >= PAID_REROLLS_PER_DAY) return null;
        if (state.gems < REROLL_GEMS) return null;
        const date = new Date();
        const weekly = period === 'weekly';
        if (period !== 'daily' && !weekly) return null;
        const view = visibleChallenges(state, date);
        const shown = weekly ? view.weekly : view.daily;
        const target = shown.find((challenge) => challenge.id === fromId);
        if (!target) return null;
        const pool = weekly ? WEEKLY_POOL : DAILY_POOL;
        const key = weekly ? weekKeyOf(date) : today;
        const swap = replacementFor(pool, shown, fromId, `paid|${key}|${used}`);
        if (!swap) return null;
        const prev = normalizeRerolls(state.questRerolls);
        const next = weekly
          ? { ...prev, weeklyKey: key, weeklyUsed: 1, weeklySwap: swap }
          : { ...prev, dailyKey: key, dailyUsed: 1, dailySwap: swap };
        set({
          gems: state.gems - REROLL_GEMS,
          questRerolls: next,
          paidRerollDay: today,
          paidRerollsToday: used + 1,
          pendingGemCharges: [...(state.pendingGemCharges || []), REROLL_GEMS].slice(-20),
        });
        syncConvenience(`reroll-${today}-${used}`, 'quest_reroll')
          .then((data) => get().adoptConvenienceReceipt(data, REROLL_GEMS))
          .catch(() => {});
        return swap;
      },

      // Spend the dupe price to take one more card in the set home again.
      raiseCardStar: (setId) => {
        const state = get();
        if (!starringUnlocked(state.ownedCards)) return null;
        const card = nextStarTarget(ALL_CARDS, state.ownedCards, state.cardStars, setId);
        if (!card) return null;
        const cost = starCost(card.id, state.cardStars, coinsForDuplicate);
        if (cost == null || state.coins < cost) return null;
        const have = Math.min(STAR_CAP, Math.floor(Number(state.cardStars[String(card.id)]) || 0));
        set({
          coins: state.coins - cost,
          cardStars: { ...state.cardStars, [String(card.id)]: have + 1 },
        });
        return { id: card.id, name: card.name, stars: have + 1, cost };
      },

      claimStarSet: (setId) => {
        const state = get();
        if (state.claimedStarSets.includes(setId)) return null;
        if (!starSetReady(ALL_CARDS, state.ownedCards, state.cardStars, setId)) return null;
        const reward = { coins: 300, packs: 1 };
        set({ claimedStarSets: [...state.claimedStarSets, setId] });
        get().addCoins(reward.coins);
        get().addCardPack(reward.packs);
        return reward;
      },

      claimMorningAfter: () => {
        const now = new Date();
        const state = get();
        if (!morningAfterDue(state, now)) return null;
        set({ morningAfterDate: now.toDateString(), coins: state.coins + MORNING_AFTER.coins });
        return { coins: MORNING_AFTER.coins, name: MORNING_AFTER.name, line: MORNING_AFTER.line };
      },

      claimLevelReward: (level) => {
        const row = trackRow(level);
        const state = get();
        if (!row || state.level < row.level || state.claimedLevelRewards.includes(row.level)) return null;
        set({ claimedLevelRewards: [...state.claimedLevelRewards, row.level] });
        if (row.coins) get().addCoins(row.coins);
        if (row.packs) get().addCardPack(row.packs);
        return { level: row.level, coins: row.coins, packs: row.packs };
      },

      claimPlaque: (id) => {
        const plaque = plaqueById(id);
        const state = get();
        if (!plaque || state.level < plaque.level || state.claimedPlaques.includes(id)) return null;
        set({ claimedPlaques: [...state.claimedPlaques, id], coins: state.coins + plaque.coins });
        return { id: plaque.id, coins: plaque.coins, name: plaque.name };
      },

      dismissStarterOffer: () => set({ starterOfferDismissed: true }),

      claimStory: (id) => {
        const chapter = storyChapters(get()).find((row) => row.id === id);
        if (!chapter || chapter.claimed || !chapter.ready) return null;
        set({ claimedChapters: [...get().claimedChapters, id] });
        if (chapter.coins) get().addCoins(chapter.coins);
        if (chapter.packs) get().addCardPack(chapter.packs);
        return { id, coins: chapter.coins, packs: chapter.packs };
      },

      claimCatchUp: () => {
        const now = new Date();
        const key = weekKeyOf(now);
        const offer = catchUpFor(get(), now, key);
        if (!offer) return null;
        const state = get();
        set({
          catchUpWeek: key,
          coins: state.coins + offer.coins,
          cardPacks: state.cardPacks + offer.packs,
        });
        return offer;
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
        // The daily open cap is checked in that same update: a second tap
        // cannot slip a pack out past it. Instant open is the gem skip.
        const field = { legendary: 'legendaryPacks', premium: 'premiumPacks', regular: 'cardPacks' };
        const today = new Date().toDateString();
        let packType = null;
        let blocked = false;
        set((s) => {
          for (const t of [requestedType, 'legendary', 'premium', 'regular']) {
            const key = field[t];
            if (key && s[key] > 0) {
              packType = t;
              if (!openAllowed({
                earnedOpensToday: s.earnedOpensToday,
                earnedOpensDay: s.earnedOpensDay,
                today,
                instant: s.instantOpen === true,
              })) {
                blocked = true;
                return {};
              }
              return { [key]: s[key] - 1 };
            }
          }
          return {};
        });
        if (!packType) return null;
        if (blocked) return { blocked: 'cap', cards: [], dupeCoins: 0 };

        const state = get();
        const slots = PACK_SLOTS[packType];
        const script = scriptedPack(slots.size);
        let rolledCards;
        let nextPity = state.packPity || 0;
        if (script) {
          rolledCards = script;
        } else {
          const rolled = rollPack({
            size: slots.size,
            table: PACK_ODDS.standard,
            rng: Math.random,
            pity: nextPity,
            cardsByRarity: cardsByRarity(ALL_CARDS),
          });
          rolledCards = rolled.cards;
          nextPity = rolled.pity;
        }

        const ownedBefore = new Set(state.ownedCards);
        const storage = storageSlotsFor(state.totalWins || 0, state.storageUnlocked === true, ALL_CARDS.length);
        const soldToday = state.sellbackDay === today ? state.sellbackToday : 0;
        const settled = settlePull({
          cards: rolledCards,
          owned: ownedBefore,
          soldToday,
          storageLeft: Math.max(0, storage - ownedBefore.size),
        });
        const openNo = (state.packOpens || 0) + 1;
        let dupeCoins = settled.coins + bonusForOpen(openNo);
        if (state.packStreakDay !== today) {
          dupeCoins += streakCoins(Math.min(7, Math.max(1, state.consecutiveLogins || 1)));
        }
        const seenNew = new Set();
        const pulledCards = rolledCards.map((card) => {
          const isNew = settled.keptIds.includes(card.id) && !ownedBefore.has(card.id) && !seenNew.has(card.id);
          if (isNew) seenNew.add(card.id);
          return { ...card, isNew };
        });
        const fresh = settled.keptIds.filter((id) => !ownedBefore.has(id));
        set({
          ownedCards: [...settled.owned],
          coins: state.coins + dupeCoins,
          weekNewCards: state.weekNewCards + fresh.length,
          packPity: nextPity,
          packOpens: openNo,
          packCoinBack: (state.packCoinBack || 0) + dupeCoins,
          sellbackToday: settled.soldToday,
          sellbackDay: today,
          earnedOpensToday: (state.earnedOpensDay === today ? state.earnedOpensToday : 0) + 1,
          earnedOpensDay: today,
          packStreakDay: today,
        });
        if (fresh.length > 0) {
          const n = settled.owned.size;
          get().checkAchievement('collect_20', n >= 20);
          get().checkAchievement('collect_40', n >= 40);
          get().checkAchievement('collect_55', n >= 55);
          get().checkAchievement('collect_all', n >= ALL_CARDS.length);
        }
        return { cards: pulledCards, dupeCoins, pity: nextPity };
      },

      // Signed-in opens ask the server to roll. The client does not send card
      // ids. Offline, and a quiet server, use the same local rules.
      openCardPackFromServer: async (requestedType = 'regular') => {
        const today = new Date().toDateString();
        const state = get();
        if (!openAllowed({
          earnedOpensToday: state.earnedOpensToday,
          earnedOpensDay: state.earnedOpensDay,
          today,
          instant: state.instantOpen === true,
        })) {
          const field = { legendary: 'legendaryPacks', premium: 'premiumPacks', regular: 'cardPacks' };
          const has = [requestedType, 'legendary', 'premium', 'regular'].some((t) => state[field[t]] > 0);
          return has ? { blocked: 'cap', cards: [], dupeCoins: 0 } : null;
        }
        const nonce = `pack-${Date.now().toString(36)}-${requestedType}`;
        try {
          const receipt = await requestPackRoll(nonce, requestedType);
          if (receipt) return get().applyServerPack(requestedType, receipt);
        } catch { /* the local roll still opens the pack */ }
        return get().openCardPack(requestedType);
      },

      applyServerPack: (packType, receipt) => {
        const field = { legendary: 'legendaryPacks', premium: 'premiumPacks', regular: 'cardPacks' };
        const today = new Date().toDateString();
        let opened = false;
        set((s) => {
          const key = field[packType];
          if (!key || s[key] <= 0) return {};
          opened = true;
          return { [key]: s[key] - 1 };
        });
        if (!opened) return null;
        const ids = Array.isArray(receipt.card_ids) ? receipt.card_ids : [];
        const keptIds = (Array.isArray(receipt.kept_ids) ? receipt.kept_ids : []).map((id) => String(id));
        const state = get();
        const owned = new Set(state.ownedCards);
        const pulledCards = [];
        for (const id of ids) {
          const card = ALL_CARDS.find((c) => String(c.id) === String(id));
          if (!card) continue;
          const isNew = keptIds.includes(String(card.id))
            && ![...owned].some((held) => String(held) === String(card.id));
          if (isNew) owned.add(card.id);
          pulledCards.push({ ...card, isNew });
        }
        const dupeCoins = Math.max(0, Math.floor(Number(receipt.coins) || 0));
        const openNo = (state.packOpens || 0) + 1;
        set({
          ownedCards: [...owned],
          coins: state.coins + dupeCoins,
          packOpens: openNo,
          packCoinBack: (state.packCoinBack || 0) + dupeCoins,
          earnedOpensToday: (state.earnedOpensDay === today ? state.earnedOpensToday : 0) + 1,
          earnedOpensDay: today,
          packStreakDay: today,
          packPity: Number.isFinite(receipt.pity) ? receipt.pity : state.packPity,
        });
        return { cards: pulledCards, dupeCoins, pity: receipt.pity };
      },

      adoptConvenienceReceipt: (data, quoted) => {
        if (!data || typeof data.balance !== 'number') return;
        const pending = [...(get().pendingGemCharges || [])];
        const at = pending.indexOf(quoted);
        if (at >= 0) pending.splice(at, 1);
        if (!data.replay && typeof data.charged === 'number' && data.charged !== quoted) {
          set((s) => ({ gems: s.gems + (quoted - data.charged), pendingGemCharges: pending }));
        } else {
          set({ pendingGemCharges: pending });
        }
        get().noteServerGemSpend(data.balance);
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

      // Every pack on the shelf, in the order a one-by-one open would take
      // them. Instant open is what allows it. The rolls are the same rolls.
      openAllPacks: async () => {
        if (get().instantOpen !== true) return null;
        const opened = [];
        for (let i = 0; i < 40; i += 1) {
          const next = get().getNextPackType();
          if (!next) break;
          const result = await get().openCardPackFromServer(next);
          if (!result || result.blocked) break;
          opened.push(result);
        }
        return opened;
      },

      buyShopItem: (itemId) => {
        const state = get();
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: "Item not found" };

        if (item.currency === 'coins') {
          if (state.coins < item.price) return { success: false, message: "Not enough coins" };
          const spentPack = item.type === 'pack' ? item.price : 0;
          set({ coins: state.coins - item.price, packCoinSpent: (state.packCoinSpent || 0) + spentPack });
        } else if (item.currency === 'gems') {
          if (state.gems < item.price) return { success: false, message: "Not enough gems" };
          set({ gems: state.gems - item.price });
        }

        if (item.type === 'pack') {
          set((s) => ({ cardPacks: s.cardPacks + item.quantity }));
          return { success: true, message: `Got ${item.quantity} ${item.quantity === 1 ? 'pack' : 'packs'}.`, type: item.type };
        }
        if (item.type === 'premium') {
          set((s) => ({ premiumPacks: s.premiumPacks + item.quantity }));
          return { success: true, message: `Got ${item.quantity} premium ${item.quantity === 1 ? 'pack' : 'packs'}.`, type: item.type };
        }
        if (item.type === 'legendary') {
          set((s) => ({ legendaryPacks: s.legendaryPacks + item.quantity }));
          return { success: true, message: `Got ${item.quantity} legendary ${item.quantity === 1 ? 'pack' : 'packs'}.`, type: item.type };
        }
        if (item.type === 'coins') {
          set((s) => ({ coins: s.coins + item.quantity }));
          return { success: true, message: `Got ${item.quantity.toLocaleString()} coins.` };
        }
        if (item.type === 'booster') {
          // Re-buying while one is already running EXTENDS it rather than
          // restarting from now — otherwise a player who buys a second day
          // early silently burns the remainder of the one they already paid for.
          const current = typeof state.coinDoublerExpiresAt === 'number' ? state.coinDoublerExpiresAt : 0;
          const from = Math.max(Date.now(), current);
          set({ coinDoublerExpiresAt: from + item.durationHours * 60 * 60 * 1000 });
          return { success: true, message: `${item.name} active for ${item.durationHours}h.`, type: item.type };
        }

        return { success: false, message: "Unknown item type" };
      },

      // True while the Coin Doubler window is still open. Read at battle-end and
      // by the Shop; derived from the timestamp so it self-expires with no timer.
      isCoinDoublerActive: () => {
        const expiry = get().coinDoublerExpiresAt;
        return typeof expiry === 'number' && expiry > Date.now();
      },

      // Whole hours left on the booster (0 when inactive) — for the Shop badge.
      coinDoublerHoursLeft: () => {
        const expiry = get().coinDoublerExpiresAt;
        if (typeof expiry !== 'number') return 0;
        return Math.max(0, Math.ceil((expiry - Date.now()) / (60 * 60 * 1000)));
      },

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      setMusicOn: (on) => set({ musicOn: on === true }),
      setMusicVolume: (volume) => set({ musicVolume: clampVolume(volume, 0) }),
      setSfxVolume: (volume) => set({ sfxVolume: clampVolume(volume, 0) }),
      setAudioMuted: (muted) => set({ audioMuted: muted === true }),
      setHapticsEnabled: (on) => set({ hapticsEnabled: on === true }),
      setTextSize: (size) => set({ textSize: size === 'large' || size === 'larger' ? size : 'default' }),
      setColorblindSafe: (on) => set({ colorblindSafe: on === true }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setTutorialCompleted: (completed) => set({ tutorialCompleted: completed }),
      markFirstFightSeen: () => set({ firstFightSeen: true }),
      // How to play's "Replay the lesson". Clears the persisted flag and
      // arms the coach for the fight that starts now, even on a difficulty
      // that would not teach it. coachNextFight is not saved (partialize).
      replayFirstFight: () => set({ firstFightSeen: false, coachNextFight: true }),
      recordDailyResult: (won, key) => {
        const patch = nextDailyRecord(get(), won, key);
        if (!patch) return null;
        set(patch);
        return patch;
      },

      // Wiping progress must NOT wipe the server-gem high-water mark. That mark
      // records how much purchased currency has already been credited locally;
      // zeroing it makes the next login's reconcileServerGems see the player's
      // entire purchase history as a fresh positive delta and credit it again.
      // Reset, relog, collect — repeatable, so one real purchase mints gems
      // forever. Progress resets; what the player already paid for does not
      // un-happen.
      //
      // Nor is it taken away: keptThroughReset (above) carries the gems, the
      // season's Premium Pass and the other paid items through. This used to
      // spread initialState over all of them, so a buyer who reset lost every
      // purchased gem for good — the kept mark meant no login could return them.
      resetProgress: () => set({
        ...initialState,
        ...keptThroughReset(get()),
        // Keep the save bound to the CURRENT account. Spreading initialState
        // would null ownerUserId, leaving an "unowned" save that still carries
        // this player's lastSyncedServerGems mark — the next DIFFERENT account to
        // sign in would then hit bindToUser's null-owner "adopt" branch (which
        // keeps state) instead of the wipe branch, inheriting the stale mark. A
        // brand-new buyer (no user_gems row → login reconcile is skipped) whose
        // purchase total lands at or below that mark would then be credited 0
        // gems: pay real money, receive nothing. Preserving the owner makes the
        // next different sign-in take the wiping branch that zeroes the mark.
        ownerUserId: get().ownerUserId,
        lastSyncedServerGems: get().lastSyncedServerGems,
        // And the cloud save's bookkeeping, so the reset reaches the account
        // as an ordinary change from the rev this device was in step with.
        // Zeroed, the reset save would read as one this device never synced,
        // and holding no progress, the next login would take the account's
        // pre-reset save back without a word (src/lib/cloudSave.js, rule 5).
        cloudRev: get().cloudRev,
        cloudSyncedHash: get().cloudSyncedHash,
        cloudSyncedAt: get().cloudSyncedAt,
        pendingAchievements: [],
        pendingLevelUps: [],
        pendingSeasonDeliveries: [],
      }),
    })),
    {
      name: 'terrible-teddies-storage',
      // The default storage calls localStorage while the module is loading.
      // Safari private mode and Lockdown Mode throw from that call, and the
      // exception escapes before React mounts. This one does not throw.
      storage: createJSONStorage(() => browserLocalStorage()),
      // 6 is the polish wardrobe. 7 runs normalizeSave for the back room.
      version: 7,
      // Don't persist in-flight UI state
      partialize: (state) => {
        const {
          pendingAchievements, pendingLevelUps, pendingSeasonDeliveries, coachNextFight: _coachNextFight, ...rest
        } = state;
        return rest;
      },
      // Normalize state persisted by any earlier release (normalizeSave).
      migrate: (persisted) => normalizeSave(persisted),
    }
  )
);

/**
 * A copy of the store holding `save` that persists nothing and touches no
 * screen: the store's own actions, run on a save other than the one in play.
 * The cloud save asks it what the calendar's rollovers (syncSeason,
 * syncPeriods) make of the save it last synced, so that it never has to keep
 * a second copy of that logic which could drift from this one.
 */
export const scratchGameStore = (save) => {
  const store = createStore(gameState);
  store.setState(normalizeSave(save));
  return store;
};

export default useGameStore;
