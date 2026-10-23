// The app's shell: the main menu's own controls, the sign-in screen's art,
// browser Back, document titles and focus between screens, and the hand-off
// from the pre-JS loader.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';

test.describe('the main menu', () => {
  test.beforeEach(async ({ page }) => {
    await bootToMainMenu(page);
  });

  // Each tile used to be both what was hovered and what the hover lifted, so
  // a pointer on its bottom 3px fell off it as it rose: the next twitch of
  // the hand unhovered it, it dropped back under the pointer, the next one
  // hovered it again, and the tile shook for as long as the pointer stayed.
  // A hand is never still, so the pointer here twitches by a pixel. With
  // motion allowed, as players have it.
  test('a pointer resting on a tile\'s bottom edge holds it lifted, still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    for (const name of ['Shop', 'Battle']) {
      const tile = page.getByRole('button', { name, exact: true });
      await expect(tile).toBeVisible(SLOW);
      await page.waitForTimeout(1200); // the entrance
      const rest = await tile.boundingBox();
      const x = rest.x + rest.width / 2;
      const y = rest.y + rest.height - 1;
      await page.mouse.move(x, y);
      await page.waitForTimeout(600); // the lift
      const tops = [];
      for (let i = 0; i < 16; i += 1) {
        await page.mouse.move(x + (i % 2), y);
        await page.waitForTimeout(60);
        tops.push(Math.round((await tile.boundingBox()).y * 10) / 10);
      }
      expect(new Set(tops).size, `${name} moves under a resting pointer: ${tops.join(', ')}`).toBe(1);
      expect(tops[0], `${name} is not lifted`).toBeLessThan(rest.y);
      await page.mouse.move(0, 0);
    }
  });

  test.describe('at 320px', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test('every header control is a 44px target, on one row', async ({ page }) => {
      await page.waitForTimeout(800); // the header's entrance
      const boxes = [];
      for (const name of ['Daily rewards', 'How to play', 'Settings']) {
        const box = await page.getByRole('button', { name }).boundingBox();
        expect(box.width, `${name} is narrower than 44px`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${name} is shorter than 44px`).toBeGreaterThanOrEqual(44);
        boxes.push(box);
      }
      expect(new Set(boxes.map((b) => Math.round(b.y))).size, 'the header row wraps').toBe(1);
    });
  });

  // Holding a finger on a tile or a card selected its text and, on iOS,
  // opened the Copy / Save Image callout. The menu and the two card grids are
  // game surfaces now, like the board and the pack reveal.
  test('a held finger selects nothing on the menu or in the card grids', async ({ page }) => {
    const selectable = (locator) => locator.evaluate((el) => getComputedStyle(el).userSelect);
    expect(await selectable(page.getByRole('button', { name: 'Shop', exact: true }))).toBe('none');
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
    expect(await selectable(page.locator('.card-zoom').first())).toBe('none');
    await page.getByRole('button', { name: '← Menu' }).click();
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible(SLOW);
    expect(await selectable(page.locator('.card-zoom').first())).toBe('none');
  });
});

// The sign-in screen is every new player's first look at the game, and it
// showed no card art at all. From lg up, where there is room beside the
// form, it fans three of the set's cards, as the menu fans a player's own.
test.describe('the sign-in screen', () => {
  const signedOut = async (page) => {
    await page.route('**testproject.supabase.co/**', (r) => r.fulfill({ json: {} }));
    await page.route('https://*.posthog.com/**', (r) => r.abort());
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible(SLOW);
  };

  test.describe('on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('shows the card fan beside the form, as decoration only', async ({ page }) => {
      await signedOut(page);
      const fan = page.locator('main [aria-hidden="true"]').filter({ has: page.locator('img') });
      await expect(fan).toHaveCount(1);
      await expect(fan.locator('img')).toHaveCount(3);
      // Real art, loaded, beside (not above) the form.
      await expect.poll(() => fan.locator('img').evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
      const art = await fan.boundingBox();
      const form = await page.locator('form').boundingBox();
      expect(art.x + art.width, 'the fan overlaps the form').toBeLessThanOrEqual(form.x);
      // Nothing in it takes a tab stop or a pointer.
      expect(await fan.evaluate((el) => el.querySelectorAll('[tabindex], button, a').length)).toBe(0);
      expect(await fan.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`).join('\n')).toBe('');
    });
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('leaves the fan out, so Sign In stays well above the fold', async ({ page }) => {
      await signedOut(page);
      await expect(page.locator('main img')).toHaveCount(0);
      const signIn = await page.getByRole('button', { name: 'Sign In' }).boundingBox();
      expect(signIn.y + signIn.height).toBeLessThanOrEqual(844);
    });
  });
});

// The system's Back — Android's gesture, an installed app's Back, the
// browser's button. Navigation is React state, not URLs, so the game was one
// history entry and Back left it from anywhere: an open dialog, the
// Collection, the middle of a battle (booking the loss as it went).
test.describe('the system Back', () => {
  test.beforeEach(async ({ page }) => {
    await bootToMainMenu(page);
  });

  const battle = (page) => page.getByRole('button', { name: 'Battle', exact: true });
  const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('terrible-teddies-storage')).state);

  test('closes the open dialog instead of leaving the game', async ({ page }) => {
    const url = page.url();
    await page.getByRole('button', { name: 'Shop', exact: true }).click();
    const shop = page.getByRole('dialog', { name: 'Shop' });
    await expect(shop).toBeVisible(SLOW);
    await page.goBack();
    await expect(shop).toHaveCount(0, SLOW);
    await expect(battle(page)).toBeVisible();
    expect(page.url()).toBe(url);
  });

  // A reload with a dialog open starts the new page on the old page's guard
  // entry, which it must not mistake for its own.
  test('still closes a dialog after a reload', async ({ page }) => {
    const shop = page.getByRole('dialog', { name: 'Shop' });
    await page.getByRole('button', { name: 'Shop', exact: true }).click();
    await expect(shop).toBeVisible(SLOW);
    await page.reload();
    await expect(battle(page)).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Shop', exact: true }).click();
    await expect(shop).toBeVisible(SLOW);
    await page.goBack();
    await expect(shop).toHaveCount(0, SLOW);
    await expect(battle(page)).toBeVisible();
  });

  test('closes only the innermost of nested dialogs', async ({ page }) => {
    await page.getByRole('button', { name: 'Shop', exact: true }).click();
    const shop = page.getByRole('dialog', { name: 'Shop' });
    await expect(shop).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'View odds' }).click();
    const odds = page.getByRole('dialog', { name: 'Pack odds' });
    await expect(odds).toBeVisible(SLOW);
    await page.goBack();
    await expect(odds).toHaveCount(0, SLOW);
    await expect(shop).toBeVisible();
    await page.goBack();
    await expect(shop).toHaveCount(0, SLOW);
    await expect(battle(page)).toBeVisible();
  });

  test('returns from the Collection to the menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Card Collection' })).toBeVisible(SLOW);
    await page.goBack();
    await expect(battle(page)).toBeVisible(SLOW);
  });

  test('from the Deck Builder asks about unsaved changes first, and otherwise just returns', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'Deck Builder' });
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(heading).toBeVisible(SLOW);
    // Unchanged: straight back to the menu.
    await page.goBack();
    await expect(battle(page)).toBeVisible(SLOW);

    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(heading).toBeVisible(SLOW);
    await page.locator('[data-deck-panel]').getByRole('button', { name: /^Remove .+ from deck$/ }).first().click();
    await expect(page.locator('[data-unsaved]')).toHaveCount(1);
    await page.goBack();
    const ask = page.getByRole('dialog', { name: 'Leave without saving?' });
    await expect(ask).toBeVisible(SLOW);
    // Back again is "Keep editing", as Escape is.
    await page.goBack();
    await expect(ask).toHaveCount(0, SLOW);
    await expect(page.locator('[data-unsaved]')).toHaveCount(1);
    await page.goBack();
    await expect(ask).toBeVisible(SLOW);
    await ask.getByRole('button', { name: 'Discard changes' }).click();
    await expect(battle(page)).toBeVisible(SLOW);
  });

  test('in a live battle asks before conceding, and Back again keeps playing', async ({ page }) => {
    await page.addInitScript(() => {
      const raw = localStorage.getItem('terrible-teddies-storage');
      const save = raw ? JSON.parse(raw) : { state: {}, version: 3 };
      save.state.currentWinStreak = 2;
      save.state.totalLosses = 0;
      localStorage.setItem('terrible-teddies-storage', JSON.stringify(save));
    });
    await page.reload();
    await battle(page).click();
    const endTurn = page.getByRole('button', { name: 'End Turn' });
    await expect(endTurn).toBeVisible(SLOW);
    const leave = page.getByRole('dialog', { name: 'Leave this battle?' });

    await page.goBack();
    await expect(leave).toBeVisible(SLOW);
    await expect(leave).toContainText('2-win streak');
    await page.goBack();
    await expect(leave).toHaveCount(0, SLOW);
    await expect(endTurn).toBeVisible();
    expect((await stored(page)).totalLosses).toBe(0);
    expect((await stored(page)).currentWinStreak).toBe(2);

    // Asked again, and this time the player goes: the loss is booked.
    await page.goBack();
    await expect(leave).toBeVisible(SLOW);
    await leave.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    await expect(battle(page)).toBeVisible(SLOW);
    expect((await stored(page)).totalLosses).toBe(1);
  });

  test('from the result screen goes back to the menu', async ({ page }) => {
    await battle(page).click();
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('dialog', { name: 'Concede this battle?' })
      .getByRole('button', { name: 'Concede — counts as a loss' }).click();
    await expect(page.getByRole('dialog', { name: 'Defeat' })).toBeVisible(SLOW);
    await page.goBack();
    await expect(battle(page)).toBeVisible(SLOW);
  });

  test('piles up no history: after twenty dialogs, Back on the menu leaves the game', async ({ page }) => {
    const before = await page.evaluate(() => window.history.length);
    const shop = page.getByRole('dialog', { name: 'Shop' });
    for (let i = 0; i < 20; i += 1) {
      await page.getByRole('button', { name: 'Shop', exact: true }).click();
      await expect(shop).toBeVisible(SLOW);
      if (i % 2) await page.keyboard.press('Escape');
      else await shop.getByRole('button', { name: 'Close shop' }).click();
      await expect(shop).toHaveCount(0, SLOW);
    }
    expect(await page.evaluate(() => window.history.length)).toBeLessThanOrEqual(before + 1);
    // Nothing open: Back does what it always did, and leaves.
    await page.goBack();
    await expect.poll(() => page.url()).toBe('about:blank');
  });
});

// Screen changes said nothing to the tab, the task switcher or a screen
// reader: the title never changed, and the focus fell to <body> as the
// control that changed the screen unmounted with it.
test.describe('between screens', () => {
  test.beforeEach(async ({ page }) => {
    await bootToMainMenu(page);
  });

  test('each screen names itself in the tab', async ({ page }) => {
    await expect(page).toHaveTitle('Terrible Teddies');
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await expect(page).toHaveTitle('Card Collection · Terrible Teddies');
    await page.getByRole('button', { name: '← Menu' }).click();
    await expect(page).toHaveTitle('Terrible Teddies');
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(page).toHaveTitle('Deck Builder · Terrible Teddies');
    await page.getByRole('button', { name: '← Menu' }).click();
    await page.getByRole('button', { name: 'Battle', exact: true }).click();
    await expect(page).toHaveTitle('Battle · Terrible Teddies');
  });

  for (const [tile, heading] of [['Collection', 'Card Collection'], ['Deck Builder', 'Deck Builder']]) {
    test(`from the keyboard, ${tile} opens on its heading and returns to its tile`, async ({ page }) => {
      const button = page.getByRole('button', { name: tile, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeFocused(SLOW);
      // The next Tab goes on from the top of the screen, starting with its
      // way back.
      await page.getByRole('button', { name: '← Menu' }).focus();
      await page.keyboard.press('Enter');
      await expect(button).toBeFocused(SLOW);
    });
  }

  test('a battle opens on its heading, and the menu hands the focus back to Battle', async ({ page }) => {
    const battle = page.getByRole('button', { name: 'Battle', exact: true });
    await battle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Battle against Chuck', level: 1 })).toBeFocused(SLOW);
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    await page.getByRole('button', { name: '← Menu' }).click();
    await page.getByRole('dialog', { name: 'Leave this battle?' })
      .getByRole('button', { name: 'Concede — counts as a loss' }).click();
    await expect(battle).toBeFocused(SLOW);
  });
});

// The pre-JS loader in index.html fades out over whatever React draws
// first. Over BootScreen that is a matched cross-fade; past it (a session
// that restores at once) the loader's medallion and wordmark ghosted over
// the menu's cards, so App clears them at once with .to-app.
test.describe('the loader hand-off', () => {
  // Every class the loader is given, in order, from before React runs.
  const recordLoaderClasses = (page) => page.addInitScript(() => {
    window.__loaderClasses = [];
    const watch = () => {
      const loader = document.getElementById('initial-loader');
      if (!loader) return false;
      new MutationObserver(() => window.__loaderClasses.push(loader.className))
        .observe(loader, { attributes: true, attributeFilter: ['class'] });
      return true;
    };
    if (!watch()) {
      const wait = new MutationObserver(() => { if (watch()) wait.disconnect(); });
      wait.observe(document, { childList: true, subtree: true });
    }
  });

  test('past BootScreen, the loader keeps only its backdrop for the fade', async ({ page }) => {
    await recordLoaderClasses(page);
    await bootToMainMenu(page);
    await expect.poll(() => page.evaluate(() => window.__loaderClasses.join(' '))).toContain('to-app');
  });

  test('over BootScreen, the loader cross-fades whole', async ({ page }) => {
    await recordLoaderClasses(page);
    // An expired token and no network: BootScreen stays up, retrying.
    await page.route('**testproject.supabase.co/**', (r) => r.abort('connectionrefused'));
    await page.route('https://*.posthog.com/**', (r) => r.abort());
    await page.addInitScript(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [
      'sb-testproject-auth-token',
      { access_token: 'x', refresh_token: 'y', expires_at: Math.floor(Date.now() / 1000) - 3600, user: { id: 'u' } },
    ]);
    await page.goto('/');
    await expect(page.getByText('Loading Terrible Teddies...')).toBeVisible(SLOW);
    await expect.poll(() => page.evaluate(() => document.getElementById('initial-loader'))).toBeNull();
    const seen = await page.evaluate(() => window.__loaderClasses);
    expect(seen.join(' ')).toContain('fade-out');
    expect(seen.join(' ')).not.toContain('to-app');
  });
});

// Announcements — achievements, level-ups, a season's delivery — arrive in
// bursts, and each used to replace the last, so all but one were cut short.
test.describe('announcements', () => {
  // Patches the save after bootToMainMenu's own seed (init scripts run in
  // the order they were added), for the next load.
  const seedSave = (page, patch) => page.addInitScript((p) => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const save = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    Object.assign(save.state, p);
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(save));
  }, patch);

  test('that arrive together are shown one after another, each in full', async ({ page }) => {
    test.skip(!!process.env.E2E_PREVIEW, 'imports the toast module from /src');
    await bootToMainMenu(page);
    await page.evaluate(async () => {
      const { toast } = await import('/src/components/ui/use-toast.js');
      toast({ queue: true, title: 'First news', description: 'One.', duration: 1500 });
      toast({ queue: true, title: 'Second news', description: 'Two.', duration: 1500 });
    });
    const toasts = page.locator('.toast-viewport > li');
    await expect(toasts.filter({ hasText: 'First news' })).toBeVisible();
    await expect(toasts.filter({ hasText: 'Second news' })).toHaveCount(0);
    await page.waitForTimeout(1000);
    // Still the first: the second has not cut it short.
    await expect(toasts.filter({ hasText: 'First news' })).toBeVisible();
    await expect(toasts.filter({ hasText: 'Second news' })).toBeVisible({ timeout: 5000 });
    await expect(toasts.filter({ hasText: 'First news' })).toHaveCount(0);
  });

  // A battle's achievements are raised in the same moment as the board's
  // game-over clear (it closes any callout as the result dialog opens), in
  // either order. That clear used to empty the line, so not one of them was
  // ever seen. This save is one battle, one point of damage and one of
  // healing short of three achievements, all earned by conceding.
  const ACHIEVEMENTS = ['Dedicated Player', 'Damage Dealer', 'Medic Bear'];
  const threeShort = { totalBattles: 99, totalDamageDealt: 1000, totalHealingDone: 500, completedAchievements: [] };
  // Each toast as it comes and goes: its text, when, and the dialog it sat on.
  const watchToasts = (page) => page.addInitScript(() => {
    window.__toastLog = [];
    const live = new Map();
    const dialogName = () => {
      const d = document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (!d) return null;
      const labelledBy = document.getElementById(d.getAttribute('aria-labelledby'));
      return d.getAttribute('aria-label') ?? labelledBy?.textContent ?? null;
    };
    new MutationObserver(() => {
      const now = performance.now();
      const open = new Set([...document.querySelectorAll('.toast-viewport > li')].filter((li) => li.dataset.state === 'open'));
      for (const li of open) {
        if (live.has(li)) continue;
        const entry = { text: li.textContent, shownAt: now, goneAt: null, over: dialogName() };
        live.set(li, entry);
        window.__toastLog.push(entry);
      }
      for (const [li, entry] of live) {
        if (open.has(li)) continue;
        entry.goneAt = now;
        live.delete(li);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
  });
  const achievementLog = (page) => page.evaluate(() => window.__toastLog.filter((t) => t.text.includes('Achievement Unlocked!')));
  const concede = async (page) => {
    await page.getByRole('button', { name: 'Battle', exact: true }).click();
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Concede', exact: true }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    await expect(page.getByRole('dialog', { name: 'Defeat' })).toBeVisible(SLOW);
  };

  test('earned in a battle are each shown in full over the result', async ({ page }) => {
    test.setTimeout(60_000);
    await bootToMainMenu(page);
    await seedSave(page, threeShort);
    await watchToasts(page);
    await page.reload();
    await concede(page);
    await expect.poll(async () => (await achievementLog(page)).filter((t) => t.goneAt).length, { timeout: 30_000 }).toBe(3);
    const log = await achievementLog(page);
    expect(log.map((t) => ACHIEVEMENTS.find((name) => t.text.includes(name)))).toEqual(ACHIEVEMENTS);
    log.forEach((t, i) => {
      expect(t.over, `${ACHIEVEMENTS[i]} is shown over the result`).toBe('Defeat');
      // Its reading time is at least 4 s: it was not cut short.
      expect(t.goneAt - t.shownAt, `${ACHIEVEMENTS[i]} is cut short`).toBeGreaterThan(3500);
      if (i > 0) expect(t.shownAt, 'two at once').toBeGreaterThanOrEqual(log[i - 1].goneAt);
    });
  });

  // Play Again while the first is up: the new game's turn banner clears the
  // spot. The one it cut short comes back whole once the banner has gone,
  // and the other two follow.
  test('earned in a battle survive Play Again pressed during the first', async ({ page }) => {
    test.setTimeout(60_000);
    await bootToMainMenu(page);
    await seedSave(page, threeShort);
    await watchToasts(page);
    await page.reload();
    await concede(page);
    const first = page.locator('.toast-viewport > li').filter({ hasText: ACHIEVEMENTS[0] });
    await expect(first).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Play Again' }).click();
    const playAgainAt = await page.evaluate(() => performance.now());
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    await expect.poll(async () => (await achievementLog(page)).filter((t) => t.goneAt).length, { timeout: 30_000 }).toBe(4);
    const log = await achievementLog(page);
    const names = log.map((t) => ACHIEVEMENTS.find((name) => t.text.includes(name)));
    expect(names).toEqual([ACHIEVEMENTS[0], ...ACHIEVEMENTS]);
    // Shown again only after the turn banner (1.3 s) has had the table.
    expect(log[1].shownAt - playAgainAt).toBeGreaterThan(1300);
    for (const t of log.slice(1)) expect(t.goneAt - t.shownAt, `${t.text} is cut short`).toBeGreaterThan(3500);
  });

  // Drawn as the result panel draws a level-up: the level on a medallion and
  // a coin icon, not ⭐ and 🪙.
  test('a level-up is drawn with the medallion and the coin, not emoji', async ({ page }) => {
    await bootToMainMenu(page);
    await seedSave(page, { level: 1, xp: 95 });
    await page.reload();
    await page.getByRole('button', { name: 'Battle', exact: true }).click();
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    await page.getByRole('button', { name: '← Menu' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    const toast = page.locator('.toast-viewport > li').filter({ hasText: 'Level 2!' });
    await expect(toast).toBeVisible(SLOW);
    await expect(toast).toContainText('Level-up bonus: +200');
    await expect(toast).not.toContainText('⭐');
    await expect(toast).not.toContainText('🪙');
    await expect(toast.locator('[aria-hidden="true"]').first()).toHaveText('2');
    await expect(toast.locator('svg')).not.toHaveCount(0);
  });

  // "No charge was made — your gems are still waiting in the shop." took
  // three lines at 320 and, over the first-run tutorial (which opens on the
  // same launch), reached its step bar.
  test('"Checkout cancelled" fits its line at 320, clear of the tutorial', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await bootToMainMenu(page);
    await seedSave(page, { tutorialCompleted: false });
    await page.goto('/?purchase=cancelled');
    const toast = page.locator('.toast-viewport > li').filter({ hasText: 'Checkout cancelled' });
    await expect(toast).toBeVisible(SLOW);
    await expect(toast).toContainText('You weren’t charged.');
    const lines = await toast.locator('.toast-description').evaluate((el) =>
      Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(lines, 'the description wraps').toBe(1);
    const tutorial = page.getByRole('dialog', { name: 'How to play' });
    await expect(tutorial.getByText('Step 1 of 9')).toBeVisible(SLOW);
    const box = await toast.boundingBox();
    for (const control of await tutorial.locator('button, [tabindex="0"]').all()) {
      if (!(await control.isVisible())) continue;
      const r = await control.boundingBox();
      const overlaps = Math.min(r.x + r.width, box.x + box.width) > Math.max(r.x, box.x)
        && Math.min(r.y + r.height, box.y + box.height) > Math.max(r.y, box.y);
      expect(overlaps, `the toast covers "${await control.getAttribute('aria-label') || await control.textContent()}"`).toBe(false);
    }
  });
});

// The empty Card Packs table names where packs come from, with a way to each.
// Daily Rewards waits for a tap now, so on a pack day the table offers it.
test('the empty Card Packs table opens Daily Rewards on a pack day', async ({ page }) => {
  await bootToMainMenu(page);
  await page.addInitScript(() => {
    const raw = localStorage.getItem('terrible-teddies-storage');
    const save = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    // Claimed through day 4 yesterday: today's claim is day 5, a pack day.
    Object.assign(save.state, {
      cardPacks: 0, premiumPacks: 0, legendaryPacks: 0,
      consecutiveLogins: 4, lastLoginDate: yesterday.toDateString(),
    });
    localStorage.setItem('terrible-teddies-storage', JSON.stringify(save));
  });
  await page.reload();
  // Unclaimed today, so Daily Rewards opens by itself on launch; put it away.
  const daily = page.getByRole('dialog', { name: 'Daily Rewards' });
  await expect(daily).toBeVisible(SLOW);
  await page.keyboard.press('Escape');
  await expect(daily).toHaveCount(0, SLOW);

  const tile = page.getByRole('button', { name: 'Card Packs', exact: true });
  await tile.click();
  const packs = page.getByRole('dialog', { name: 'Card packs' });
  await expect(packs.getByRole('heading', { name: 'No packs to open' })).toBeVisible(SLOW);
  await expect(packs).toContainText("Today's daily reward.");
  await packs.getByRole('button', { name: 'Open Daily Rewards' }).click();
  await expect(daily).toBeVisible(SLOW);
  await expect(packs).toHaveCount(0);
  // The reward is there to claim, and closing the panel lands back on the tile.
  await expect(daily.getByRole('button', { name: 'Claim', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(daily).toHaveCount(0, SLOW);
  await expect(tile).toBeFocused();
});
