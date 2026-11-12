// What the menu says around the Battle button, in tables and pure helpers, so
// the lines can be rewritten without touching the layout and menuLines.test.js
// can hold every one of them to the slot it fills. On the boot path (the menu
// is the first screen), so no imports beyond the notes' own tiny module.
import { FOOTER_NOTES, pickLine } from './mgmtNotes';

// The line under the wordmark, small caps, one line at 320px (31 characters;
// the deck measured the widest at 277px of 288). The first is the brand's own
// line and is what a cold launch shows; every later visit to the menu in the
// same page load picks one of the rest.
export const HERO_MAX = 31;
export const HERO_LINES = Object.freeze([
  'Bad bears · Worse decisions',
  'Sit anywhere. Not there',
  "Regulars only. You'll do",
  'Same as last time?',
  'We were just talking about you',
  "We've seen you do worse",
  "Avoid the sticky booth",
  "Whatever you heard, it's true",
  'Nobody judges. We take notes',
  'You smell like a bad decision',
]);

// The footer pool: the shipped line first, then the notes management has left
// for the regulars (no Chuck: the Battle button's line owns him).
export const FOOTER_MAX = 44;
export const SHIPPED_FOOTER = 'Version 1.0 · No teddies were harmed (lie)';
export const FOOTER_LINES = Object.freeze([SHIPPED_FOOTER, ...FOOTER_NOTES]);

// The destination tiles' one line each (hidden below md). Challenges and the
// Deck Builder keep the lines they shipped with.
export const TILE_MAX = 42;
export const TILE_LINES = Object.freeze({
  challenges: 'Prove you have a problem',
  battlepass: 'A punch card for bad behavior',
  shop: 'Spend money you don’t have',
  packs: 'Gambling, but cuter',
  deck: 'Assemble your goon squad',
  collection: 'Everyone you’ve ever pulled',
  leaderboard: 'Who’s on top. Ask their ex.',
  nightly: 'One sitting. No rematch.',
  wardrobe: 'What you wear when the cards come off',
  pub: 'A live one. Bring a deck.',
});

// The streak line under the Battle button, by the running streak: one win, a
// streak, a long one. From two wins up it keeps "N-win streak" (e2e and the
// leave dialog say the same words).
export const STREAK_MAX = 34;
export const streakLine = (n) => {
  if (n >= 5) return `${n}-win streak. Insufferable.`;
  if (n >= 2) return `${n}-win streak. Don’t blow it.`;
  return 'One win. Don’t get cocky.';
};

// Which line a visit to the menu shows. The first visit of a page load (a cold
// launch, and every screenshot) shows variant 0; later visits (back from a
// battle, a screen, a dialog) pick another, never the same one twice in a row.
// Picked in a useState initializer, once per mount, never per render. The
// counter is module state on purpose: it is "this page load", not the save.
//
// Choosing and recording are two steps. StrictMode (the dev server) renders a
// component twice, and a counter that moved while choosing would have the
// second pass take the "later visit" branch, so a cold launch would never show
// variant 0 in development. Choosing only reads; the menu records what it
// showed from an effect, which runs once it is on screen.
let visits = 0;
let lastHero = null;
let lastFooter = null;

export const heroLineForVisit = (random = Math.random) => (
  visits === 0 ? HERO_LINES[0] : pickLine(HERO_LINES.slice(1), lastHero, random)
);

// The shipped footer whenever the closed sign's own note is on screen (2-6
// a.m.): two notes from management in one view is one too many.
export const footerLineForVisit = ({ closed = false, random = Math.random } = {}) => (
  closed ? SHIPPED_FOOTER : pickLine(FOOTER_LINES, lastFooter, random)
);

/** The menu is on screen showing these: the next visit shows others. */
export const recordMenuVisit = (hero, footer) => {
  visits += 1;
  lastHero = hero;
  lastFooter = footer;
};

// For tests: back to a cold launch.
export const resetMenuVisits = () => {
  visits = 0;
  lastHero = null;
  lastFooter = null;
};
