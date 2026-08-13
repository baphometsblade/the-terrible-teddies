// End-to-end smoke tests for Terrible Teddies.
//
// Fully hermetic: a fake Supabase session is seeded into localStorage before
// the app boots (supabase-js restores it from the `sb-<ref>-auth-token` key),
// and every request to the fake Supabase project, the sound CDN, and PostHog
// is stubbed or aborted in the browser. No real backend is contacted.
//
// The session/stub/boot plumbing lives in e2e/helpers/session.js so
// e2e/a11y.spec.js can reuse the identical hermetic boot.
import { getDailyChallenges } from '../src/stores/challenges.js';
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

test.beforeEach(async ({ page }) => {
  // Main menu is the shared starting point for every test.
  await bootToMainMenu(page);
});

test('app boots to the main menu without page errors', async ({ page, pageErrors }) => {
  // Player profile (top-left card) shows the seeded player.
  const profile = page.getByRole('button', { name: 'View player stats' });
  await expect(profile).toBeVisible();
  await expect(profile).toContainText('QA Bear');

  // Battle menu tile is present (already awaited in beforeEach, re-assert).
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible();

  expect(pageErrors, `Unexpected page errors: ${pageErrors.map((e) => e.message).join('; ')}`)
    .toHaveLength(0);
});

test('battle starts and a full turn plays out', async ({ page, pageErrors }) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();

  // Board is up once the End Turn control appears (after the draw phase).
  const endTurn = page.getByRole('button', { name: 'End Turn' });
  await expect(endTurn).toBeVisible(SLOW);
  await expect(page.getByText(/Turn 1/)).toBeVisible(SLOW);

  // Play one full turn: end our turn, let the AI take its turn, and wait for
  // control to come back to the player on turn 2.
  await endTurn.click();
  await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
  await expect(endTurn).toBeVisible(SLOW);

  expect(pageErrors, `Unexpected page errors: ${pageErrors.map((e) => e.message).join('; ')}`)
    .toHaveLength(0);
});

test('abandoning a battle mid-game records a loss and resets the win streak', async ({ page }) => {
  // Seed a live win streak, then bail out of a joined battle via "← Menu".
  // Leaving must count as a loss — otherwise a losing game can be dropped with
  // the streak intact. Runs after the beforeEach seed (init scripts fire in
  // registration order), patching the state it wrote.
  await page.addInitScript(() => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    stored.state.currentWinStreak = 3;
    stored.state.totalLosses = 0;
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  });
  await page.reload();

  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  // End Turn visible == the opening hand was dealt (deckReady) == battle joined.
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);

  await page.getByRole('button', { name: '← Menu' }).click();
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);

  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('terrible-teddies-storage')).state);
  expect(state.totalLosses).toBe(1);
  expect(state.currentWinStreak).toBe(0);
});

test('reloading/closing mid-battle also records the loss (pagehide), not just "← Menu"', async ({ page }) => {
  // The unmount-only safeguard is bypassed by F5/tab-close: React cleanups don't
  // run on a full page unload, and battle state isn't persisted. A pagehide
  // handler must record the loss. We fire pagehide directly and read the
  // synchronously-persisted store — a real reload would re-run the seed init
  // script and clobber the write, hiding the very thing under test.
  await page.addInitScript(() => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    stored.state.currentWinStreak = 3;
    stored.state.totalLosses = 0;
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  });
  await page.reload();

  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);

  // Simulate the tab being unloaded (reload/close) without actually navigating.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('terrible-teddies-storage')).state);
  expect(state.totalLosses).toBe(1);
  expect(state.currentWinStreak).toBe(0);
});

test('shop opens, shows gem bundles with prices, and closes on Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Shop' });
  await expect(dialog).toBeVisible(SLOW); // lazy-loaded chunk

  await dialog.getByRole('button', { name: 'Buy Gems' }).click();

  // Five gem bundles, each an accessible button labelled with its $ price.
  const bundles = dialog.getByRole('button', { name: /^Buy \d+ gems for \$\d+\.\d{2}$/ });
  await expect(bundles).toHaveCount(5, SLOW);
  for (const bundle of await bundles.all()) {
    await expect(bundle).toContainText(/\$\d+\.\d{2}/);
  }

  // The dialog hook closes on Escape.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, SLOW);
});

test('buying a gem bundle starts Stripe checkout for that exact bundle', async ({ page }) => {
  // Guards the revenue path end to end (button -> edge function). Intercept the
  // create-checkout-session call, capture the bundle id it was invoked with, and
  // hand back a same-origin URL so the redirect stays hermetic (no real Stripe).
  // Registered here (after the beforeEach Supabase catch-all) so it wins by
  // Playwright's last-registered-first routing.
  let checkoutBody = null;
  await page.route('**/functions/v1/create-checkout-session', async (route) => {
    checkoutBody = route.request().postDataJSON();
    await route.fulfill({ json: { url: '/?purchase=cancelled' } });
  });

  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Shop' });
  await expect(dialog).toBeVisible(SLOW);
  await dialog.getByRole('button', { name: 'Buy Gems' }).click();

  // The smallest bundle — "Buy 50 gems for $0.99" — maps to bundle id gems_small.
  await dialog.getByRole('button', { name: 'Buy 50 gems for $0.99' }).click();

  await expect.poll(() => checkoutBody, SLOW).not.toBeNull();
  expect(checkoutBody.bundle_id).toBe('gems_small');
});

test('returning from a completed checkout confirms the credited gems', async ({ page }) => {
  // The other half of the revenue path: after Stripe redirects back with
  // ?purchase=success&session_id=…, the app must verify the session and show the
  // buyer their gems. Stub the purchase-verification and balance reads as a
  // completed order (registered before goto so they win over the beforeEach
  // Supabase catch-all).
  // verifyPurchaseSession/fetchServerGemBalance use .maybeSingle(), which unwraps
  // a one-element array — so return arrays here.
  await page.route(/\/rest\/v1\/purchases/, (route) =>
    route.fulfill({ json: [{ gems_granted: 500, bundle_id: 'gems_large', status: 'completed' }] })
  );
  await page.route(/\/rest\/v1\/user_gems/, (route) =>
    route.fulfill({ json: [{ gems: 556 }] })
  );

  await page.goto('/?purchase=success&session_id=cs_test_e2e');

  const dialog = page.getByRole('dialog', { name: 'Purchase status' });
  await expect(dialog).toBeVisible(SLOW);
  await expect(dialog.getByText('Purchase Complete!')).toBeVisible(SLOW);
  await expect(dialog.getByText(/500/)).toBeVisible();

  await dialog.getByRole('button', { name: /Let.?s Play/ }).click();
  await expect(dialog).toHaveCount(0, SLOW);
});

test('a stuck verification is not a trap: the verifying phase has an escape hatch', async ({ page }) => {
  // Hang the purchase-verification read so the dialog stays in 'verifying'.
  // Escape is intentionally disabled during verification, so without an explicit
  // control the buyer would be stranded on a control-free spinner.
  await page.route(/\/rest\/v1\/purchases/, () => { /* never fulfilled */ });

  await page.goto('/?purchase=success&session_id=cs_test_stuck');

  const dialog = page.getByRole('dialog', { name: 'Purchase status' });
  await expect(dialog).toBeVisible(SLOW);
  await expect(dialog.getByText('Verifying Payment…')).toBeVisible(SLOW);

  const escape = dialog.getByRole('button', { name: /Close and check back later/ });
  await expect(escape).toBeVisible();
  await escape.click();
  await expect(dialog).toHaveCount(0, SLOW);
});

test('deck builder renders the owned-card grid', async ({ page }) => {
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);

  // Owned cards are clickable "Add <name> to deck" tiles; the default
  // collection owns 11 cards, so at least 5 must render.
  const ownedCards = page.getByRole('button', { name: /^Add .+ to deck$/ });
  await expect(ownedCards.first()).toBeVisible(SLOW);
  expect(await ownedCards.count()).toBeGreaterThanOrEqual(5);
});

test('collection card-detail is a real dialog: focus enters it, Escape closes it', async ({ page }) => {
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);

  // Open the first owned card's detail. Tiles are "View <name>" pressables.
  await page.getByRole('button', { name: /^View / }).first().click();

  const detail = page.getByRole('dialog', { name: /details$/ });
  await expect(detail).toBeVisible(SLOW);
  // useDialog moves focus into the panel (its Close button is the first control).
  await expect(detail.getByRole('button', { name: 'Close' })).toBeFocused();

  // Escape closes it (the raw overlay it replaced had no keyboard exit).
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0, SLOW);
});

test('deck builder Save-As is a real dialog: focus enters it, Escape closes it', async ({ page }) => {
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);

  // The seeded currentDeck is a full 10 cards, so "Save As..." is enabled.
  await page.getByRole('button', { name: 'Save As...' }).click();

  const save = page.getByRole('dialog', { name: 'Save deck' });
  await expect(save).toBeVisible(SLOW);
  // The hook focuses the first control — the deck-name input — with no autoFocus.
  await expect(save.getByRole('textbox', { name: 'Deck name' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(save).toHaveCount(0, SLOW);
});

test('manifest app shortcuts (?action=) route to the right screen', async ({ page }) => {
  // The PWA manifest's shortcuts (long-press the installed icon) launch the
  // app with ?action=battle|shop|rewards — verify each actually navigates,
  // since nothing previously read this param.
  await page.goto('/?action=battle');
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);

  await page.goto('/?action=shop');
  await expect(page.getByRole('dialog', { name: 'Shop' })).toBeVisible(SLOW);

  await page.goto('/?action=rewards');
  await expect(page.getByRole('dialog', { name: 'Daily Rewards' })).toBeVisible(SLOW);
});

test('a played creature waits a turn to attack, then exhausts and recovers', async ({ page, pageErrors }) => {
  // Force a deck of pure cheap action cards so the first play is always an
  // attack-capable creature (the default deck shuffles in traps/specials).
  //
  // This must be an init script, not a post-load page.evaluate: the beforeEach
  // seed is itself an addInitScript, so it re-runs on every navigation and
  // rewrites the store (without currentDeck) on reload — a plain evaluate would
  // be clobbered, leaving the default mixed deck and a first play that is
  // sometimes a trap. Init scripts run in registration order, so this one runs
  // after the beforeEach seed on the reload below and its deck wins.
  await page.addInitScript(() => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    stored.state.currentDeck = [1, 2, 3, 4, 5, 6];
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Battle', exact: true }).click(SLOW);

  const endTurn = page.getByRole('button', { name: 'End Turn' });
  await expect(endTurn).toBeVisible(SLOW);

  // Chuck's opener is summoning-sick too. The player's field is empty before
  // the first play, so exactly one "Warming Up" here is Chuck's — without this
  // the opener would get a free turn-1 swing the player cannot answer.
  await expect(page.getByText('Warming Up')).toHaveCount(1);

  // Turn 1 — play a creature. It arrives summoning-sick, so it must NOT be
  // able to swing this turn: selecting it never opens targeting.
  await page.getByRole('button', { name: /^Play / }).first().click();
  const attacker = page.getByRole('button', { name: /^Select .+ to attack$/ }).first();
  await expect(attacker).toBeVisible(SLOW);
  await expect(page.getByText('Warming Up')).toHaveCount(2); // Chuck's opener + the new arrival
  await page.getByRole('button', { name: '⚔️ Battle' }).click();
  await attacker.click();
  // The crosshair affordance renders only while targeting is open, so its
  // absence is what proves the selection was refused.
  //
  // Weaker assertions that look right but are not: "Warming Up is visible"
  // passes on Chuck's opener even with player sickness deleted, and "Exhausted
  // has count 0" passes because this test never clicks a target — so a creature
  // that DID open targeting still would not be exhausted. Both would keep
  // passing with the whole rule removed.
  await expect(page.locator('.cursor-crosshair')).toHaveCount(0);

  // Turn 2 — sickness has lifted, so the same creature can now attack. This is
  // also the exhaustion regression: the opponent turn write-back must not
  // restore the flags it was stamped with on turn 1.
  await endTurn.click();
  await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
  await expect(page.getByText('Warming Up')).toHaveCount(0);
  await page.getByRole('button', { name: '⚔️ Battle' }).click();
  await attacker.click();
  // Click whatever the board marks as hittable — a valid creature target, or
  // the direct-attack zone when only traps/stealth remain. Taking the first
  // "Attack <name>" button instead is wrong once Chuck has several creatures:
  // taunt can make the first one an invalid target, and the click then
  // silently no-ops.
  const hittable = page.locator('.cursor-crosshair').first();
  await expect(hittable).toBeVisible(SLOW);
  await hittable.click();
  await expect(page.getByText('Exhausted').first()).toBeVisible(SLOW);

  // Survive the opponent's turn: the attacker must NOT still be Exhausted on
  // turn 3 (a stale write-back once bricked surviving attackers permanently).
  await endTurn.click();
  await expect(page.getByText(/Turn 3/)).toBeVisible(SLOW);
  await expect(endTurn).toBeVisible(SLOW);
  await expect(page.getByText('Exhausted')).toHaveCount(0);

  expect(pageErrors, `Unexpected page errors: ${pageErrors.map((e) => e.message).join('; ')}`)
    .toHaveLength(0);
});

test('concede shows the defeat dialog and Play Again deals a fresh game', async ({ page }) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);

  page.once('dialog', (d) => d.accept()); // window.confirm on concede
  await page.getByRole('button', { name: /Concede/ }).click();

  // Game-over screen is a real dialog with rewards and both exits.
  const defeat = page.getByRole('dialog', { name: 'Defeat' });
  await expect(defeat).toBeVisible(SLOW);
  await expect(defeat.getByText('Battle Rewards')).toBeVisible();
  await expect(defeat.getByRole('button', { name: 'Menu' })).toBeVisible();

  await defeat.getByRole('button', { name: 'Play Again' }).click();
  await expect(defeat).toHaveCount(0, SLOW);
  await expect(page.getByText(/Turn 1/)).toBeVisible(SLOW);
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
});

test('Escape closes only the innermost layer of nested dialogs', async ({ page }) => {
  await page.getByRole('button', { name: 'Battle Pass', exact: true }).click();
  const pass = page.getByRole('dialog', { name: /battle pass/i });
  await expect(pass).toBeVisible(SLOW);

  // Open the nested premium purchase confirmation.
  await pass.getByRole('button', { name: /unlock premium/i }).click();
  await expect(page.getByText(/500/).first()).toBeVisible();

  // First Escape dismisses the confirm overlay but keeps the pass open…
  await page.keyboard.press('Escape');
  await expect(pass).toBeVisible();
  // …second Escape closes the pass itself.
  await page.keyboard.press('Escape');
  await expect(pass).toHaveCount(0, SLOW);
});

test('challenges dialog shows daily challenges and closes on Escape', async ({ page }) => {
  await page.getByRole('button', { name: 'Challenges', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Challenges' });
  await expect(dialog).toBeVisible(SLOW); // lazy-loaded chunk

  // Daily tab is active by default and lists today's 4 rotating daily
  // challenges (src/stores/challenges.js — deterministic by calendar date,
  // so this matches whatever the app itself computed for "today").
  const todaysDaily = getDailyChallenges();
  expect(todaysDaily).toHaveLength(4);
  for (const challenge of todaysDaily) {
    await expect(dialog.getByText(challenge.name, { exact: true })).toBeVisible(SLOW);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, SLOW);
});

test('a dialog chunk that fails to load degrades gracefully, not a full-app crash', async ({ page }) => {
  // Regression guard for the app-killing lazy-chunk failure: a dynamic import
  // that rejects (flaky network, or a stale chunk hash after a deploy) used to
  // throw past Suspense to the app-level ErrorBoundary, which wraps EVERYTHING —
  // replacing the menu and any in-progress game with the full crash screen over
  // a dialog the user merely tried to open. DialogErrorBoundary now scopes it.
  //
  // Force the Shop chunk to fail. In dev the dynamic import resolves to the Shop
  // module URL (…/components/Shop.jsx); in a production build it's a hashed asset
  // (…/assets/Shop-<hash>.js). Match both — "Shop" followed by a dot or dash — so
  // this guard holds under the prod-preview e2e run too.
  await page.route(/Shop[-.]/, (r) => r.abort());

  await page.getByRole('button', { name: 'Shop', exact: true }).click();

  // The scoped notice appears...
  const notice = page.getByRole('alertdialog', { name: /failed to load/i });
  await expect(notice).toBeVisible(SLOW);

  // ...and crucially the app itself survived: the menu's Battle button is still
  // there, and the app-level crash screen ("Oh no!") is NOT shown.
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible();
  await expect(page.getByText('Oh no!')).toHaveCount(0);

  // Dismissing returns to a fully usable app.
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toHaveCount(0, SLOW);
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible();
});

test('every pay line sends the right bundle id to checkout', async ({ page }) => {
  // The revenue path has SEVEN entry points — five gem tiles plus two special
  // offers — and only one of them was covered. A tile wired to the wrong id
  // charges the wrong price (or, if the id is unknown to the edge function,
  // 400s and the sale is simply lost), and the webhook refuses to credit on any
  // amount mismatch. This walks all seven.
  const calls = [];
  await page.route('**/functions/v1/create-checkout-session', async (route) => {
    calls.push(route.request().postDataJSON().bundle_id);
    // Reply WITHOUT a url. redirectToStripeCheckout then throws
    // "No checkout URL returned" before it ever assigns window.location.href,
    // so the page never navigates and the shop stays open for the next tile.
    // (Returning a url instead makes the app navigate, which races this test's
    // own page.goto and fails the run under parallelism.) The bundle id is
    // already captured above — that is the whole assertion. Shop's catch calls
    // setProcessing(false), so the next tile is immediately clickable.
    await route.fulfill({ json: {} });
  });

  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Shop' });
  await expect(dialog).toBeVisible(SLOW);

  // --- The five gem tiles, keyed by their accessible "Buy N gems for $X" name.
  const TILES = [
    { label: 'Buy 50 gems for $0.99', id: 'gems_small' },
    { label: 'Buy 150 gems for $2.99', id: 'gems_medium' },
    { label: 'Buy 500 gems for $9.99', id: 'gems_large' },
    { label: 'Buy 1200 gems for $19.99', id: 'gems_huge' },
    { label: 'Buy 3000 gems for $49.99', id: 'gems_mega' },
  ];

  await dialog.getByRole('button', { name: 'Buy Gems' }).click();
  for (const tile of TILES) {
    await dialog.getByRole('button', { name: tile.label }).click();
    await expect.poll(() => calls.length, SLOW).toBeGreaterThan(0);
    expect(calls.pop(), `"${tile.label}" must charge ${tile.id}`).toBe(tile.id);
  }

  // --- The two special offers, which live on their own tab.
  const OFFERS = [
    { tile: /Starter/i, id: 'starter_bundle', button: 'Buy Now' },
    { tile: /Mega Gem Pack/i, id: 'weekly_gem_pass', button: '$5.99' },
  ];

  await dialog.getByRole('button', { name: 'Special Offers' }).click();
  for (const offer of OFFERS) {
    await expect(dialog.getByText(offer.tile).first()).toBeVisible(SLOW);
    await dialog.getByRole('button', { name: offer.button, exact: true }).first().click();
    await expect.poll(() => calls.length, SLOW).toBeGreaterThan(0);
    expect(calls.pop(), `the ${offer.id} offer must charge ${offer.id}`).toBe(offer.id);
  }
});

test('settings controls keep keyboard focus when toggled', async ({ page }) => {
  // SettingRow/DifficultyButton used to be declared INSIDE the Settings render,
  // which makes a new component type every render — so React remounted the
  // subtree instead of updating it and focus fell to <body>. A keyboard user
  // lost their place on every toggle. (axe can't catch this: it audits a static
  // snapshot, not focus across interactions.)
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible(SLOW);

  // Difficulty buttons: activating one by keyboard must leave focus on it.
  const hard = dialog.getByRole('button', { name: /Hard/ });
  await hard.focus();
  await page.keyboard.press('Enter');
  await expect(hard).toHaveAttribute('aria-pressed', 'true');
  await expect(hard).toBeFocused();

  // The same for a Switch inside a SettingRow.
  const sound = dialog.getByRole('switch', { name: 'Sound Effects' });
  await sound.focus();
  const before = await sound.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  await expect(sound).not.toHaveAttribute('aria-checked', before ?? '');
  await expect(sound).toBeFocused();
});
