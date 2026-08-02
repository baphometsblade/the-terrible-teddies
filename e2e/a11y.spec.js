// Accessibility regression guard for Terrible Teddies.
//
// Runs @axe-core/playwright (WCAG 2.1 A/AA) against every screen and dialog
// in the app — main menu, collection, deck builder, battle board, and the six
// dialogs — asserting zero violations on each. Reuses the same hermetic
// session/stubbing boot as e2e/smoke.spec.js (see e2e/helpers/session.js) so
// this spec never touches a real backend.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Waits for entrance animations to finish before axe samples the page.
//
// This is not padding: axe composites an element's colour against everything
// behind it, so an element caught mid-fade reports the *blended* colour rather
// than its resting one. The leaderboard's "YOU" badge is night-950 on
// brass-400 — 9.4:1 at rest — but scanned at ~64% opacity it composites to
// #452c15 on #9c6408 and reports a bogus 2.61:1 failure. Note that the
// suite-wide `reducedMotion: 'reduce'` does not prevent this: framer-motion
// treats opacity as vestibular-safe and keeps animating it under reduced
// motion, dropping only the transform/layout part.
//
// The leaderboard staggers 10 rows at 50ms each, so the last one starts at
// ~500ms; the buffer covers that plus the fade itself.
async function settle(page) {
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, {
      timeout: 5_000,
    })
    .catch(() => {}); // framer drives some animations off rAF, not WAAPI — the wait below covers those
  await page.waitForTimeout(900);
}

// Runs axe and asserts zero violations, printing a readable summary (rule,
// impact, node count, and the offending HTML/failure reason for each node)
// in the assertion message when something regresses.
async function expectNoViolations(page, label) {
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const summary = results.violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    - ${n.html}\n      ${n.failureSummary.replace(/\n/g, '\n      ')}`)
        .join('\n');
      return `[${v.impact}] ${v.id} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}): ${v.help}\n${nodes}`;
    })
    .join('\n\n');

  expect(
    results.violations,
    `axe found ${results.violations.length} violation type(s) on "${label}":\n\n${summary}`
  ).toHaveLength(0);
}

test.beforeEach(async ({ page }) => {
  await bootToMainMenu(page);
});

test('main menu has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await expectNoViolations(page, 'main menu');
});

test('collection has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
  await expectNoViolations(page, 'collection');
});

test('battle board has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  await expectNoViolations(page, 'battle board');
});

test('shop dialog has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Shop' })).toBeVisible(SLOW);
  await expectNoViolations(page, 'shop dialog');
});

test('challenges dialog has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Challenges' })).toBeVisible(SLOW);
  await expectNoViolations(page, 'challenges dialog');
});

test('settings dialog has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible(SLOW);
  await expectNoViolations(page, 'settings dialog');
});

test('deck builder has no WCAG 2.1 A/AA violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);
  await expectNoViolations(page, 'deck builder');
});

// The remaining dialogs are all reached the same way and only need their
// trigger + accessible dialog name, so they share one table-driven test
// rather than five near-identical copies.
const DIALOGS = [
  { trigger: 'Battle Pass', dialog: 'Battle Pass' },
  { trigger: 'Rankings', dialog: 'Leaderboard' },
  { trigger: 'Card Packs', dialog: 'Card packs' },
];

for (const { trigger, dialog } of DIALOGS) {
  test(`${dialog} dialog has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.getByRole('button', { name: trigger, exact: true }).click();
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible(SLOW);
    await expectNoViolations(page, `${dialog} dialog`);
  });
}

test('player stats dialog has no WCAG 2.1 A/AA violations', async ({ page }) => {
  // Opened from the avatar chip in the menu header, not a menu tile.
  await page.getByLabel('View player stats').click();
  await expect(page.getByRole('dialog', { name: 'Player stats' })).toBeVisible(SLOW);
  await expectNoViolations(page, 'player stats dialog');
});
