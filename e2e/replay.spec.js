import { expect, test, seedSignedIn, stubSupabase, SLOW } from './helpers/session.js';
import { cardsFor } from '../src/lib/pvp/decks.js';
import { packLog } from '../src/lib/replay/codec.js';
import { createMatch, applyIntent } from '../src/lib/combat/engine.js';

const ids = [1, 2, 3, 4, 5, 6, 30, 40, 41, 42];

function sampleLog() {
  const deckA = cardsFor(ids);
  const deckB = cardsFor(ids);
  const rules = { id: 'standard', hp: 0, energy: 0, damage: 0 };
  let state = createMatch({ seed: 4, deckA, deckB, nameA: 'Ada', nameB: 'Bea', rules, first: 'a' });
  const actions = [];
  const push = (seat, intent) => {
    const next = applyIntent(state, { seat, intent });
    state = next.state;
    actions.push({ seat, intent });
  };
  push('a', { type: 'mulligan', toss: [] });
  push('b', { type: 'mulligan', toss: [] });
  push('a', { type: 'end' });
  push('b', { type: 'end' });
  return packLog({ seed: 4, deckA, deckB, rules, names: ['Ada', 'Bea'], kind: 'pvp', actions });
}

test('replay controls step, scrub, and change speed', async ({ page }) => {
  const log = sampleLog();
  await stubSupabase(page);
  await seedSignedIn(page);
  await page.addInitScript((tape) => {
    sessionStorage.setItem('tt-replay', JSON.stringify(tape));
  }, log);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Watch it back' })).toBeVisible(SLOW);
  const root = page.locator('[data-replay-root]');
  await expect(root).toHaveAttribute('data-frame', '0');
  await page.getByRole('button', { name: 'On a beat' }).click();
  await expect(root).toHaveAttribute('data-frame', '1');
  await page.getByRole('button', { name: 'Back a beat' }).click();
  await expect(root).toHaveAttribute('data-frame', '0');
  await page.locator('#replay-scrub').fill('3');
  await expect(root).toHaveAttribute('data-frame', '3');
  await page.getByRole('button', { name: '2x' }).click();
  await page.getByRole('button', { name: 'Play the night' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Watch it back' })).toHaveCount(0);
});
