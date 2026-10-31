// The battle board's cards: how they read on the table and in the hand, how
// the hand fits a phone, how a touch screen plays a card, and what the result
// panel says about XP. Each test names the defect it pins.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
import { getDailyChallenges } from '../src/stores/challenges.js';
import { getCurrentSeason } from '../src/utils/season.js';
import { QUIPS } from '../src/utils/teddyTalk.js';

// axe against what this spec adds that the a11y spec never opens: the result
// panel's level-up beat and the card preview. Sampled once everything has
// settled, since axe composites colours and a mid-fade element reports a
// blended one (see e2e/a11y.spec.js).
const expectNoAxeViolations = async (page, label) => {
  await page.waitForTimeout(2600); // the panel's last beat lands at ~1.9s
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`).join('\n');
  expect(violations, `axe on ${label}:\n${summary}`).toHaveLength(0);
};

// Merges into the saved game for the next reload (the boot's own seed runs on
// every navigation, and init scripts run in registration order, so this one
// wins).
const seed = (page, state) => page.addInitScript((extra) => {
  const raw = localStorage.getItem('terrible-teddies-storage');
  const stored = raw ? JSON.parse(raw) : { state: {}, version: 3 };
  Object.assign(stored.state, extra);
  localStorage.setItem('terrible-teddies-storage', JSON.stringify(stored));
}, state);

const toBattle = async (page) => {
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
};

const handCards = (page) => page.locator('[data-hand-id]');
const preview = (page) => page.locator('[data-card-preview]');

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // Overlapped cards hide their cost coins, and a tap that played at once left
  // no way to read a card before committing it. Mouse, Enter and Space still
  // play on the first press (the rest of the suite clicks once, on a desktop
  // pointer, and keeps passing).
  test('the first tap raises a hand card and opens its preview; the second plays it', async ({ page }) => {
    await bootToMainMenu(page);
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] }); // Bar-Fight Barry: costs 1
    await page.reload();
    await toBattle(page);
    const energy = page.locator('[data-energy]');
    const played = page.locator('[data-field="player"]');

    const card = page.getByRole('button', { name: 'Play Bar-Fight Barry' }).nth(2);
    await card.tap();
    await expect(card).toHaveAttribute('data-raised', '');
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(card.getByText('Tap again to play')).toBeVisible();
    // The hand strip clips what rises above it: the hint has to fit inside.
    const hint = await card.getByText('Tap again to play').boundingBox();
    const strip = await page.locator('.board-zoom').boundingBox();
    expect(hint.y, 'the hint is cut off at the top of the hand').toBeGreaterThanOrEqual(strip.y);
    await expect(played).toHaveCount(0);
    await expect(energy).toHaveText('3/3');
    await expectNoAxeViolations(page, 'a raised hand card and its preview');

    // A tap anywhere else lowers it, and plays nothing.
    await page.locator('.felt-table').tap({ position: { x: 20, y: 20 } });
    await expect(page.locator('[data-raised]')).toHaveCount(0);
    await expect(preview(page)).toHaveCount(0);
    await expect(played).toHaveCount(0);

    // Raise, then tap the raised card: it plays, once.
    await card.tap();
    await expect(card).toHaveAttribute('data-raised', '');
    await card.tap();
    await expect(played).toHaveCount(1, SLOW);
    await expect(energy).toHaveText('2/3');
    await expect(page.locator('[data-raised]')).toHaveCount(0);
  });

  // A screen reader activates a card with a click and no finger behind it.
  // Its user cannot see a raised card and would hear nothing happen, so that
  // plays at once, as Enter does.
  test('a click with no tap behind it (a screen reader activating the card) plays at once', async ({ page }) => {
    await bootToMainMenu(page);
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    // A real tap on a card first, so the board has seen a finger come down.
    await page.locator('[data-field="opponent"]').first().tap();
    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).nth(1).dispatchEvent('click');
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await expect(page.locator('[data-raised]')).toHaveCount(0);
  });

  // Holding a card down is how a table card is read, so players do the same
  // to a hand card. A click once counted as a tap only within a second of
  // the finger landing: a slower press read as a screen reader's click and
  // played the card at once — energy spent, the card committed, no undo.
  // Real touch events through CDP, as a finger sends them.
  test('holding a hand card down raises it, however long the hold, and never plays it', async ({ page, context }) => {
    await bootToMainMenu(page);
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    const card = page.getByRole('button', { name: 'Play Bar-Fight Barry' }).nth(2);
    const box = await card.boundingBox();
    const point = { x: box.x + 20, y: box.y + box.height / 2, radiusX: 5, radiusY: 5, id: 1 };
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    // Still held: the card is already up, with its preview.
    await page.waitForTimeout(700);
    await expect(card).toHaveAttribute('data-raised', '');
    await expect(preview(page)).toBeVisible();
    await page.waitForTimeout(500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    await expect(card).toHaveAttribute('data-raised', '');
    await expect(page.locator('[data-field="player"]')).toHaveCount(0);
    await expect(page.locator('[data-energy]')).toHaveText('3/3');
    // The next tap on it is the one that plays.
    await card.tap();
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
  });

  // What decides "tap" is the click's own pointer type (and a finger having
  // come down on that card), not how long ago the finger landed. A finger
  // that drifts during a long press cancels the hold but still clicks.
  test('a finger\'s click raises however late it lands; a click from no finger plays', async ({ page }) => {
    await bootToMainMenu(page);
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    const card = page.getByRole('button', { name: 'Play Bar-Fight Barry' }).nth(2);
    const box = await card.boundingBox();
    const at = (dx = 0) => ({ pointerType: 'touch', isPrimary: true, pointerId: 9, clientX: box.x + 20 + dx, clientY: box.y + box.height / 2 });
    const click = (pointerType) => card.evaluate((el, type) => el.dispatchEvent(new PointerEvent('click', {
      bubbles: true, cancelable: true, pointerType: type, isPrimary: true,
    })), pointerType);

    await card.dispatchEvent('pointerdown', at());
    await card.dispatchEvent('pointermove', at(14)); // past the hold's 10px
    await page.waitForTimeout(1200);
    await card.dispatchEvent('pointerup', at(14));
    await click('touch');
    await expect(card).toHaveAttribute('data-raised', '');
    await expect(page.locator('[data-field="player"]')).toHaveCount(0);

    // A finger lands, then a click that says it came from no pointer at all
    // (a screen reader's activation): it plays, at once.
    const other = page.getByRole('button', { name: 'Play Bar-Fight Barry' }).nth(0);
    const b2 = await other.boundingBox();
    const on = { pointerType: 'touch', isPrimary: true, pointerId: 10, clientX: b2.x + 20, clientY: b2.y + b2.height / 2 };
    await other.dispatchEvent('pointerdown', on);
    await other.dispatchEvent('pointerup', on);
    await other.evaluate((el) => el.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: '' })));
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
  });

  // Below a row zoom of 0.8 the table drops a card's name (it would render
  // under 8px), and the name was the card's only words wherever the card is
  // content rather than a control: Chuck's row outside targeting, a creature
  // warming up. A screen reader heard "1 1 Warming Up" and no name. 390x664
  // is an iPhone in Safari, at a zoom of 0.73. Each card now reads once, in
  // words, name first, its state said once.
  test('a table card that is not a control says its name and state once, where the table hides the name', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await bootToMainMenu(page);
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    const zoom = await page.locator('[data-field="opponent"]').first().evaluate((el) => {
      let z = 1;
      for (let a = el; a; a = a.parentElement) z *= parseFloat(getComputedStyle(a).zoom) || 1;
      return z;
    });
    expect(zoom, 'this viewport no longer hides the names: pick a shorter one').toBeLessThan(0.8);

    const play = page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first();
    await play.focus();
    await page.keyboard.press('Enter');
    const barry = page.locator('[data-field="player"]');
    await expect(barry).toHaveCount(1, SLOW);
    await expect(barry).not.toHaveAttribute('role');
    expect(await barry.ariaSnapshot()).toBe('- text: Bar-Fight Barry. 2 attack, 1 of 1 HP. Warming Up.');

    // Chuck's opener, warming up too, between attacks: no role, and its name
    // is the one his card is drawn with (the preview shows it whole).
    const opener = page.locator('[data-field="opponent"]').first();
    await expect(opener).not.toHaveAttribute('role');
    const words = await opener.ariaSnapshot();
    // (Quoted when the words hold a colon, as an ability's rules do.)
    const read = words.match(/^- text: "?(.+?)\. (\d+ attack, \d+ of \d+ HP\..*?)"?$/);
    expect(read, `Chuck's card reads "${words}"`).toBeTruthy();
    expect(read[2].match(/Warming Up/g), 'its state, said once').toHaveLength(1);
    const box = await opener.boundingBox();
    const at = { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    await opener.dispatchEvent('pointerdown', at);
    await expect(preview(page)).toContainText(read[1]);
    await opener.dispatchEvent('pointerup', at);
  });

  // Reading Chuck's card mid-turn: hold it down. The hold must not also act
  // on the card (on an attack target, that would be an attack).
  test('holding a table card down opens its preview, and letting go closes it', async ({ page }) => {
    await bootToMainMenu(page);
    await toBattle(page);
    const opener = page.locator('[data-field="opponent"]').first();
    await expect(opener).toBeVisible(SLOW);
    const box = await opener.boundingBox();
    const at = { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    await opener.dispatchEvent('pointerdown', at);
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveAttribute('aria-hidden', 'true');
    await opener.dispatchEvent('pointerup', at);
    await expect(preview(page)).toHaveCount(0);
    // A quick tap is not a hold: no preview.
    await opener.dispatchEvent('pointerdown', at);
    await opener.dispatchEvent('pointerup', at);
    await page.waitForTimeout(700);
    await expect(preview(page)).toHaveCount(0);
  });
});

test.describe('with a mouse and a keyboard', () => {
  test.beforeEach(async ({ page }) => { await bootToMainMenu(page); });

  test('Enter plays a hand card from the keyboard, at once, and its name stays "Play <name>"', async ({ page }) => {
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    const card = page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first();
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await expect(page.locator('[data-raised]')).toHaveCount(0);
  });

  // Each keyboard move used to drop the focus on the page: the played card
  // goes inert on its way out, a target stops being a control once hit, and
  // End Turn leaves the screen for Chuck's turn. A screen reader lost its
  // place, and the board's own I key stopped answering until a Tab.
  test('the focus moves on after a keyboard play, End Turn, Cancel and an attack, never to the page', async ({ page }) => {
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    const barry = page.getByRole('button', { name: 'Play Bar-Fight Barry' });
    await barry.first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    // The card now in its place.
    await expect(barry.first()).toBeFocused();

    const endTurn = page.getByRole('button', { name: 'End Turn' });
    await endTurn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
    await expect(endTurn).toBeFocused(SLOW);

    // Pick the attacker, let it go with Cancel (the focus goes back to it,
    // since Cancel leaves with the targeting), pick it again and hit a
    // target, all from the keys.
    const attacker = page.getByRole('button', { name: 'Select Bar-Fight Barry to attack' });
    await attacker.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Cancel' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Pick a victim/)).toHaveCount(0);
    await expect(attacker).toBeFocused();
    await page.keyboard.press('Enter');
    const target = page.locator('[data-field="opponent"]:has([data-target-ring]), [role="button"][aria-label="Attack opponent directly"]').first();
    await target.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Pick a victim/)).toHaveCount(0);
    // Barry has swung and nothing else can: End Turn.
    await expect(endTurn).toBeFocused();
  });

  // Rally spends the whole gauge, so its button leaves the screen as it is
  // pressed. The gauge fills by playing (+1) and swinging (+2, +3 at the
  // face), so the test plays and swings with every Barry it can, by mouse,
  // until Rally is offered, and presses only Rally from the keys.
  test('Rally from the keys leaves the focus on End Turn, not the page', async ({ page }) => {
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    const rally = page.getByRole('button', { name: 'Rally!' });
    const endTurn = page.getByRole('button', { name: 'End Turn' });
    const play = page.getByRole('button', { name: 'Play Bar-Fight Barry' });
    const attacker = page.getByRole('button', { name: 'Select Bar-Fight Barry to attack' });
    const prompt = page.getByText(/^Pick a victim/);
    for (let turn = 1; turn <= 5 && !(await rally.isVisible()); turn += 1) {
      while (await attacker.count() && !(await rally.isVisible())) {
        await attacker.first().click();
        await expect(prompt).toBeVisible();
        await page.locator('[data-field="opponent"]:has([data-target-ring]), [role="button"][aria-label="Attack opponent directly"], [role="button"][aria-label="Strike (springs trap)"]').first().click();
        await expect(prompt).toHaveCount(0, SLOW);
      }
      const energy = async () => parseInt(await page.locator('[data-energy]').textContent(), 10);
      while (!(await rally.isVisible()) && await play.count() && await energy() > 0
        && await page.locator('[data-field="player"]:not([data-exiting])').count() < 3) {
        await play.first().click();
        await page.waitForTimeout(300);
      }
      if (await rally.isVisible()) break;
      await endTurn.click();
      await expect(page.getByText(new RegExp(`Turn ${turn + 1}`))).toBeVisible(SLOW);
      await expect(endTurn).toBeVisible(SLOW);
    }
    await rally.focus();
    await page.keyboard.press('Enter');
    await expect(rally).toHaveCount(0);
    await expect(endTurn).toBeFocused();
  });

  // A screen reader hears a card control's name — "Play Bar-Fight Barry" —
  // and a button's children are presentational, so the cost, the stats, the
  // ability and the state on the card face never reached it at all.
  test('every card control carries the card in words: cost, attack, HP, ability and state', async ({ page }) => {
    await seed(page, { currentDeck: [4, 4, 4, 6, 6, 6] }); // Barry (1), Sally (Taunt, 2)
    await page.reload();
    await toBattle(page);
    await expect(page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first())
      .toHaveAccessibleDescription('Costs 1 energy. 2 attack, 1 of 1 HP.');
    await expect(page.getByRole('button', { name: 'Play Shit-Talk Sally' }).first())
      .toHaveAccessibleDescription(/^Costs 2 energy\. 2 attack, 3 of 3 HP\. Taunt: Enemies must attack this card first\.$/);

    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    await page.getByRole('button', { name: 'Play Shit-Talk Sally' }).first().click();
    await expect(page.locator('[data-energy]')).toHaveText('0/3');
    // What the dimming says: pressed now, it would be refused.
    await expect(page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first())
      .toHaveAccessibleDescription('Costs 1 energy. 2 attack, 1 of 1 HP. Not enough energy.');
    await page.getByRole('button', { name: 'End Turn' }).click();
    await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
    const attacker = page.getByRole('button', { name: 'Select Bar-Fight Barry to attack' });
    await expect(attacker).toBeVisible(SLOW);
    // On the table: no cost, it has been paid.
    await expect(attacker).toHaveAccessibleDescription('2 attack, 1 of 1 HP.');
    await attacker.click();
    const targets = page.getByRole('button', { name: /^Attack (?!opponent)/ });
    await expect(targets.first()).toBeVisible();
    for (const t of await targets.all()) {
      await expect(t).toHaveAccessibleDescription(/^\d+ attack( \(\+1 from a Royal ally\))?, \d+ of \d+ HP\./);
    }
  });

  // Royal's +1 was always dealt (effectiveAttack) but never drawn: the badge
  // read the printed attack, so the table's numbers did not add up to the
  // log's, and nobody could count lethal.
  test('a Royal ally\'s +1 shows on the badge it raises, in the preview and in the card\'s words', async ({ page }) => {
    await seed(page, { currentDeck: [14, 4, 4, 4, 4, 4] }); // Slumlord Cotton (Royal, 4) + Barry
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    const barry = page.locator('[data-field="player"][data-card-id^="p-4-"]');
    const badge = barry.locator('[data-stat="attack"]');
    await expect(badge).toHaveText('2', SLOW);
    await expect(badge).not.toHaveAttribute('data-buffed');

    await page.getByRole('button', { name: 'End Turn' }).click();
    await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Play Slumlord Cotton' }).click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(2, SLOW);
    await expect(badge).toHaveText('3');
    await expect(badge).toHaveAttribute('data-buffed', '');
    await expect(badge).toHaveAttribute('title', 'Attack (includes +1 from a Royal ally)');
    // Cotton does not raise himself.
    const cotton = page.locator('[data-field="player"][data-card-id^="p-14-"]');
    await expect(cotton.locator('[data-stat="attack"]')).toHaveText('3');
    await expect(cotton.locator('[data-stat="attack"]')).not.toHaveAttribute('data-buffed');
    await expect(page.getByRole('button', { name: 'Select Bar-Fight Barry to attack' }))
      .toHaveAccessibleDescription('3 attack (+1 from a Royal ally), 1 of 1 HP.');

    await page.mouse.move(0, 0);
    await barry.hover();
    await expect(preview(page).locator('[data-stat="attack"]')).toHaveText('3');
  });

  // The result panel's upsell comes before Play Again in the DOM, and the
  // dialog focused its first control: for every player low on gems or
  // packs, Enter left the battle for the Shop.
  // Both with motion and without, since the panel leaves on its own timing.
  for (const animationsEnabled of [true, false]) {
  test(`the result panel opens on Play Again, and Enter plays again (animations ${animationsEnabled ? 'on' : 'off'})`, async ({ page }) => {
    await seed(page, { gems: 10, cardPacks: 0, animationsEnabled });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    const panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    await expect(panel.getByRole('button', { name: 'Visit Shop' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Play Again' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    await expect(page.getByRole('dialog', { name: 'Shop' })).toHaveCount(0);
    // Play Again leaves with the panel: the focus goes on to the new game,
    // not to the page.
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeFocused();
  });
  }

  // TeddyCard drew a pointer on every card face, under the board's own
  // cursors, so Chuck's cards and a warming-up creature looked clickable.
  test('only a card that takes a press shows a pointer', async ({ page }) => {
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await page.waitForTimeout(500);
    const cursorAt = (locator) => locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return getComputedStyle(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)).cursor;
    });
    expect(await cursorAt(page.locator('[data-field="opponent"]').first()), 'Chuck\'s card outside targeting').toBe('auto');
    expect(await cursorAt(page.locator('[data-field="player"]').first()), 'a creature warming up').toBe('auto');
    expect(await cursorAt(handCards(page).last()), 'a playable hand card').toBe('pointer');
  });

  // Hover with a mouse and keyboard focus both open the enlarged card, and on
  // a wide table it sits beside the rows rather than over them.
  test('hovering or focusing a card opens it at full size, clear of the table\'s cards', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, { currentDeck: [6, 6, 6, 6, 6, 6] }); // Shit-Talk Sally: Taunt
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: /^Play / }).first().click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await page.mouse.move(0, 0);

    const card = handCards(page).first();
    await card.hover();
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(preview(page)).toContainText('Shit-Talk Sally');
    // The ability's rules, which the card itself only names.
    await expect(preview(page)).toContainText('Enemies must attack this card first');
    const shown = await preview(page).locator(':scope > div').boundingBox();
    for (const el of await page.locator('[data-field]').all()) {
      const b = await el.boundingBox();
      const overlap = shown.x < b.x + b.width && b.x < shown.x + shown.width && shown.y < b.y + b.height && b.y < shown.y + shown.height;
      expect(overlap, 'the preview covers a card on the table').toBe(false);
    }
    await page.mouse.move(0, 0);
    await expect(preview(page)).toHaveCount(0);

    // Table cards too.
    await page.locator('[data-field="opponent"]').first().hover();
    await expect(preview(page)).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(preview(page)).toHaveCount(0);

    // The keyboard: focus alone opens it, and it closes when focus moves on.
    await card.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(card).toBeFocused();
    await expect(preview(page)).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect(preview(page)).toHaveCount(0);
  });

  // The preview used to sit over the middle of the felt at every phone width:
  // tabbing to a creature put a 2x card on top of the very card that had the
  // focus (WCAG 2.4.11), and nothing but moving focus took it away (1.4.13).
  test('a keyboard-opened preview keeps clear of the focused card\'s row, and Escape closes it until focus moves', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await page.getByRole('button', { name: 'End Turn' }).click();
    await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
    const attacker = page.getByRole('button', { name: 'Select Bar-Fight Barry to attack' });
    await expect(attacker).toBeVisible(SLOW);

    const clearOf = (field) => page.evaluate((side) => {
      const shown = document.querySelector('[data-card-preview] > div').getBoundingClientRect();
      const focused = document.activeElement.getBoundingClientRect();
      const cx = focused.x + focused.width / 2;
      const cy = focused.y + focused.height / 2;
      const rowCovered = [...document.querySelectorAll(`[data-field="${side}"]`)].some((el) => {
        const b = el.getBoundingClientRect();
        return shown.x < b.right && b.x < shown.right && shown.y < b.bottom && b.y < shown.bottom;
      });
      return {
        focusCovered: cx > shown.x && cx < shown.right && cy > shown.y && cy < shown.bottom,
        rowCovered,
      };
    }, field);

    // Keyboard focus, as Tab gives it.
    await attacker.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(attacker).toBeFocused();
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toContainText('next card');
    expect(await clearOf('player')).toEqual({ focusCovered: false, rowCovered: false });

    await page.keyboard.press('Escape');
    await expect(preview(page)).toHaveCount(0);
    await expect(attacker).toBeFocused();
    await page.waitForTimeout(500);
    await expect(preview(page)).toHaveCount(0);

    // Targeting: the focus is on Chuck's row now, and the preview takes the
    // other half.
    await page.keyboard.press('Enter');
    const target = page.getByRole('button', { name: /^Attack (?!opponent)/ }).first();
    await expect(target).toBeVisible();
    await target.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await expect(preview(page)).toBeVisible();
    expect(await clearOf('opponent')).toEqual({ focusCovered: false, rowCovered: false });
  });

  // Focus only reaches cards with a tab stop. Chuck's cards outside targeting,
  // a creature warming up and the hand on Chuck's turn have none (giving them
  // one would be a dead stop), so a keyboard player had no way to read them.
  test('I steps the preview through every card, tab stop or not; Escape closes it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, { currentDeck: [6, 4, 4, 4, 4, 4] }); // Sally (Taunt) first
    await page.reload();
    await toBattle(page);
    const opener = page.locator('[data-field="opponent"]').first();
    await expect(opener).toBeVisible(SLOW);
    const openerName = await opener.locator('[title]').first().getAttribute('title');
    const shows = () => preview(page).locator('[title]').first();

    // From a control that is not a card: the first card on the table.
    await page.getByRole('button', { name: '← Menu' }).focus();
    await page.keyboard.press('i');
    await expect(preview(page)).toBeVisible();
    await expect(shows()).toHaveAttribute('title', openerName);
    await expect(preview(page)).toContainText('next card');
    await expectNoAxeViolations(page, 'a keyboard-opened preview with its keys');

    // Play Sally from the keyboard: she is warming up, with no tab stop.
    const sally = page.getByRole('button', { name: 'Play Shit-Talk Sally' });
    await sally.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await expect(page.getByRole('button', { name: /^Select Shit-Talk Sally/ })).toHaveCount(0);

    // From the first hand card, Shift+I goes back across the table: Sally,
    // then Chuck's opener; I comes forward again.
    // (By role: Sally's own slot is still leaving the hand, inert.)
    const first = page.getByRole('button', { name: /^Play / }).first();
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('Shift+I');
    await expect(shows()).toHaveAttribute('title', 'Shit-Talk Sally');
    // Sally's own row is kept clear: the focus is in the hand, so the row to
    // keep clear is the card's.
    await expect(preview(page)).toContainText('Enemies must attack this card first');
    await page.keyboard.press('Shift+I');
    await expect(shows()).toHaveAttribute('title', openerName);
    await page.keyboard.press('i');
    await expect(shows()).toHaveAttribute('title', 'Shit-Talk Sally');

    await page.keyboard.press('Escape');
    await expect(preview(page)).toHaveCount(0);
    // After Escape, I starts again at the focused card. Focus moving on
    // ends I's preview, even when it shows a card other than the one that
    // had the focus.
    await page.keyboard.press('i');
    await expect(shows()).toHaveAttribute('title', 'Bar-Fight Barry');
    await page.keyboard.press('Shift+I');
    await expect(shows()).toHaveAttribute('title', 'Shit-Talk Sally');
    await page.getByRole('button', { name: '← Menu' }).focus();
    await expect(preview(page)).toHaveCount(0);
  });

  // WCAG 1.4.13: what hovering shows can itself be hovered (a magnifier user
  // has to move onto it to read it), and Escape dismisses it without moving
  // the mouse.
  test('the mouse can move onto a hover preview without losing it, and Escape dismisses it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page, { currentDeck: [6, 6, 6, 6, 6, 6] });
    await page.reload();
    await toBattle(page);
    const card = handCards(page).first();
    await card.hover();
    await expect(preview(page)).toBeVisible();
    const shown = await preview(page).locator(':scope > div').boundingBox();
    await page.mouse.move(shown.x + shown.width / 2, shown.y + shown.height / 2, { steps: 12 });
    await page.waitForTimeout(700);
    await expect(preview(page)).toBeVisible();
    await page.mouse.move(2, 2);
    await expect(preview(page)).toHaveCount(0);

    await card.hover();
    await expect(preview(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(preview(page)).toHaveCount(0);
    await page.waitForTimeout(600);
    await expect(preview(page)).toHaveCount(0);
  });

  // effectiveCost lowered a Swarm card's cost once another creature was down,
  // and the hand checked affordability with it — but the coin drew the printed
  // cost, so a "2" card lit up as playable on 1 energy.
  test('a Swarm card shows the cost it would actually take, in green', async ({ page }) => {
    await seed(page, { currentDeck: [2, 4, 4, 4, 4, 4] }); // Feral Tim (Swarm, 2) + Barry (1)
    await page.reload();
    await toBattle(page);
    const tim = page.getByRole('button', { name: 'Play Feral Tim' });
    const coin = tim.locator('[data-cost]');
    await expect(coin).toHaveText('2');
    await expect(coin).not.toHaveAttribute('data-discounted');

    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await expect(coin).toHaveText('1');
    await expect(coin).toHaveAttribute('data-discounted', '');
    await expect(coin).toHaveAttribute('title', 'Discounted from 2');

    // And it costs what the coin says.
    await expect(page.locator('[data-energy]')).toHaveText('2/3');
    await tim.click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(2, SLOW);
    await expect(page.locator('[data-energy]')).toHaveText('1/3');
  });

  // Below ~900px there is no room beside the rows, so the hover preview of a
  // card on your side opens over Chuck's row. Picking an attacker leaves the
  // pointer resting on it: its preview opened over the targets, and the first
  // click on one only closed it.
  test('at 768x1024 one click on a target attacks, with the attacker\'s preview never in the way', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    await page.getByRole('button', { name: 'End Turn' }).click();
    await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
    const attacker = page.getByRole('button', { name: 'Select Bar-Fight Barry to attack' });
    await expect(attacker).toBeVisible(SLOW);
    await page.mouse.move(0, 0);
    await attacker.hover();
    await page.waitForTimeout(500);
    await expect(preview(page)).toBeVisible();
    await attacker.click();
    await expect(page.getByText(/^Pick a victim/)).toBeVisible();
    await expect(preview(page)).toHaveCount(0);

    const target = page.locator('[data-field="opponent"]:has([data-target-ring]), [role="button"][aria-label="Attack opponent directly"]').first();
    const box = await target.boundingBox();
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(at.x, at.y, { steps: 8 });
    await page.mouse.click(at.x, at.y);
    await expect(page.getByText(/^Pick a victim/)).toHaveCount(0);
    await expect(page.locator('[role="log"]')).toContainText(/Bar-Fight Barry (smacked|took|decked)/);
  });

  // The ability callout is an opaque panel on the centre line, where the
  // "Pick a victim" prompt appears: picking an attacker straight after a play
  // — the normal flow, now that a turn is one phase — hid the prompt for the
  // rest of the callout's 1.5s. And an earlier play's timer took a later
  // callout down early.
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    test(`at ${viewport.width}x${viewport.height} picking an attacker clears the ability callout off the prompt`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seed(page, { currentDeck: [4, 4, 4, 6, 6, 6] }); // Barry, and Sally (Taunt)
      await page.reload();
      await toBattle(page);
      await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
      await page.getByRole('button', { name: 'End Turn' }).click();
      await expect(page.getByText(/Turn 2/)).toBeVisible(SLOW);
      const attacker = page.getByRole('button', { name: 'Select Bar-Fight Barry to attack' });
      await expect(attacker).toBeVisible(SLOW);
      const callout = page.locator('[data-ability-callout]');

      const firstPlay = Date.now();
      await page.getByRole('button', { name: 'Play Shit-Talk Sally' }).first().click();
      await expect(callout).toBeVisible();
      await attacker.click();
      const prompt = page.getByText(/^Pick a victim/);
      await expect(prompt).toBeVisible();
      await expect(callout).toHaveCount(0, { timeout: 800 });
      await page.getByRole('button', { name: 'Cancel' }).click();

      // A second callout outlives the first play's timer.
      await page.waitForTimeout(Math.max(0, firstPlay + 900 - Date.now()));
      await page.getByRole('button', { name: 'Play Shit-Talk Sally' }).first().click();
      await expect(callout).toBeVisible();
      await page.waitForTimeout(Math.max(0, firstPlay + 2100 - Date.now()));
      expect(await callout.count(), 'the first play\'s timer took the second callout down').toBe(1);
    });
  }

  // Play Again kept the hand's AnimatePresence across games, so the last
  // game's cards played out beside the new deal, holding their slots.
  test('Play Again deals a fresh hand, with none of the last game\'s cards still leaving', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await toBattle(page);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    const panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    await panel.getByRole('button', { name: 'Play Again' }).click();
    expect(await page.evaluate(() => document.querySelectorAll('[data-hand-id][inert]').length)).toBe(0);
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  });
});

// The table drew the hand card scaled to the felt: names at 5.3px on a 320px
// phone, a TAUNT tag over the first line of the name, a cost that has already
// been paid, and a row 24px taller than its card for the status chip.
test('a table card drops its cost and rarity, wears Taunt as a frame, and carries its status on itself', async ({ page }) => {
  await bootToMainMenu(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { currentDeck: [6, 6, 6, 6, 6, 6] });
  await page.reload();
  await toBattle(page);
  await page.getByRole('button', { name: /^Play / }).first().click();
  const sally = page.locator('[data-field="player"]');
  await expect(sally).toHaveCount(1, SLOW);
  await page.waitForTimeout(400);

  await expect(sally.locator('[data-variant="board"]')).toHaveCount(1);
  await expect(page.locator('[data-field] [data-cost]')).toHaveCount(0);
  await expect(page.locator('[data-field] [data-rarity-gem]')).toHaveCount(0);
  await expect(sally.locator('[data-taunt="player"]')).toHaveCount(1);
  expect(await sally.getByText('TAUNT', { exact: true }).count(), 'the old tag over the name').toBe(0);

  // "Warming Up" is drawn over the card, and the slot is the card's height.
  const card = await sally.locator('[data-variant="board"]').boundingBox();
  const chip = await sally.getByText('Warming Up', { exact: true }).boundingBox();
  expect(chip.y).toBeGreaterThanOrEqual(card.y);
  expect(chip.y + chip.height).toBeLessThanOrEqual(card.y + card.height);
  const slot = await sally.boundingBox();
  expect(Math.abs(slot.height - card.height), 'the row reserves room below the card again').toBeLessThanOrEqual(1);

  // Warming Up and still a Taunt, which still decides where Chuck attacks:
  // the art dims, the frame does not (the board used to fade the whole card).
  await expect(sally.locator('[data-art]')).toHaveAttribute('data-resting', '');
  await expect.poll(() => sally.locator('[data-taunt]').evaluate((el) => {
    let opacity = 1;
    for (let a = el; a; a = a.parentElement) opacity *= parseFloat(getComputedStyle(a).opacity);
    return opacity;
  }), { message: 'the Taunt frame is faded with the resting card' }).toBe(1);
});

// Letter-spaced text that renders under 8px splits apart at 1x ("COMM ON",
// "E PIC"). The rows are scaled to the felt, so what counts is the size on
// screen: on a 320px phone, with a stealthed card (its band) and Chuck's
// opener on the table, nothing there may be tracked that small.
test('at 320x640 nothing on the table is letter-spaced at the size it renders', async ({ page }) => {
  await bootToMainMenu(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await seed(page, { currentDeck: [7, 7, 7, 7, 7, 7] }); // Peeping Pete: Stealth
  await page.reload();
  await toBattle(page);
  await page.getByRole('button', { name: /^Play / }).first().click();
  await expect(page.getByText('STEALTH', { exact: true })).toBeVisible(SLOW);
  const tracked = await page.evaluate(() => [...document.querySelectorAll('[data-field] *')]
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((el) => {
      const cs = getComputedStyle(el);
      let zoom = 1;
      for (let a = el; a; a = a.parentElement) zoom *= parseFloat(getComputedStyle(a).zoom) || 1;
      return { text: el.textContent.trim(), px: parseFloat(cs.fontSize) * zoom, spacing: cs.letterSpacing };
    })
    .filter((t) => t.px < 8 && t.spacing !== 'normal' && parseFloat(t.spacing) !== 0)
    .map((t) => `${t.text} (${t.px.toFixed(1)}px, ${t.spacing})`));
  expect(tracked).toEqual([]);
});

// At full spacing an opening hand of six is 616px wide: on a 390px phone the
// fourth card was cut at the edge and two were off screen. Five cards fan
// widest (3° a place), six overlap furthest.
for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }]) {
  for (const [count, deck] of [[5, [1, 2, 3, 4, 5]], [6, [1, 2, 3, 4, 5, 6, 7]]]) {
  test(`at ${viewport.width}x${viewport.height} a hand of ${count} fits, every card tappable`, async ({ page }) => {
    await bootToMainMenu(page);
    await page.setViewportSize(viewport);
    await seed(page, { currentDeck: deck }); // five dealt, plus a draw if one is left
    await page.reload();
    await toBattle(page);
    await expect(handCards(page)).toHaveCount(count, SLOW);
    await page.waitForTimeout(600);

    const fit = await page.evaluate(() => {
      const strip = document.querySelector('.board-zoom');
      const zoom = parseFloat(getComputedStyle(strip).zoom) || 1;
      const cards = [...strip.querySelectorAll('[data-hand-id]')];
      // The strip of cards is not transformed (the cards are: the fan), so
      // its box is exact on screen, and the cards sit on it at equal steps.
      const row = cards[0].parentElement.getBoundingClientRect();
      const card = 96 * zoom;
      const step = cards.length > 1 ? (row.width - card) / (cards.length - 1) : card;
      // Where a thumb lands on each card's visible strip, low on the card
      // (the fan turns about the bottom edge): the card must be what is there.
      const hits = cards.map((c, i) => {
        const x = row.left + i * step + Math.min(step, card) / 2;
        const y = row.top + 0.65 * 144 * zoom;
        return document.elementFromPoint(x, y)?.closest('[data-hand-id]') === c;
      });
      // Each card's cost coin is the topmost thing at its own centre. The hand
      // overlaps left to right, so a coin in the right-hand corner sat under
      // the next card on every card but the last.
      const coins = cards.map((c) => {
        const coin = c.querySelector('[data-cost]');
        if (!coin) return 'no coin';
        const r = coin.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-hand-id]') === c;
      });
      return {
        coins,
        scroll: strip.scrollWidth - strip.clientWidth,
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        inside: row.left >= 0 && row.right <= window.innerWidth,
        minStrip: step,
        hits,
        fanned: getComputedStyle(cards[0]).transform !== 'none',
      };
    });
    expect(fit.scroll, 'the hand still scrolls').toBeLessThanOrEqual(0);
    expect(fit.doc).toBeLessThanOrEqual(1);
    expect(fit.inside, 'the hand runs off the screen').toBe(true);
    expect(fit.minStrip, 'a card shows less than a 44px strip').toBeGreaterThanOrEqual(44);
    expect(fit.hits, 'a card is covered where it should be tapped').toEqual(fit.hits.map(() => true));
    expect(fit.fanned, 'the fan is gone').toBe(true);
    expect(fit.coins, 'a hand card\'s cost is hidden under its neighbour').toEqual(fit.coins.map(() => true));
  });
  }
}

test('the board and the pack reveal take no text selection, art takes no taps, and nothing double-tap zooms', async ({ page }) => {
  await bootToMainMenu(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');
  await toBattle(page);
  const board = await page.locator('.game-surface').first().evaluate((el) => ({
    select: getComputedStyle(el).userSelect,
    insideBoard: !!el.querySelector('.felt-table'),
  }));
  expect(board).toEqual({ select: 'none', insideBoard: true });
  const art = page.locator('[data-hand-id] img').first();
  await expect(art).toHaveCSS('pointer-events', 'none');

  await page.getByRole('button', { name: '← Menu' }).click();
  await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
  await page.getByRole('button', { name: 'Card Packs', exact: true }).click(SLOW);
  const stage = page.getByRole('group', { name: 'Pack table' });
  await expect(stage).toBeVisible(SLOW);
  await expect(stage).toHaveCSS('user-select', 'none');
});

test.describe('XP and level-ups', () => {
  // A level-up paid 100 x the new level in coins with no word anywhere; the
  // panel said "+20 XP · +5".
  test('the result panel shows a level-up and its coins, and the menu does not toast it again', async ({ page }) => {
    await bootToMainMenu(page);
    // 90 season XP, in the live season: the loss's 20 opens Battle Pass tier 2.
    await seed(page, { level: 1, xp: 95, seasonXP: 90, seasonKey: getCurrentSeason().key });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    const panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    const levelUp = panel.locator('[data-level-up]');
    await expect(levelUp).toContainText('Level 2');
    await expect(levelUp).toContainText('+200');
    await expect(panel.getByRole('progressbar', { name: 'Level 2: 15 of 150 XP' })).toBeAttached();

    await expect(panel.locator('[data-pass-tier]')).toHaveText('Battle Pass tier 2 unlocked');
    await expectNoAxeViolations(page, 'the result panel with a level-up');

    await panel.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await page.waitForTimeout(2500); // past the drain's delay
    expect(await page.locator('.toast-viewport').getByText(/Level 2!/).count()).toBe(0);
  });

  // Away from the result panel, App announces it: a battle left through
  // "← Menu" books the loss (and its XP) on the way out.
  test('a level-up from an abandoned battle is toasted on the menu', async ({ page }) => {
    await bootToMainMenu(page);
    await seed(page, { level: 1, xp: 95 });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: '← Menu' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    const toast = page.locator('.toast-viewport > li').filter({ hasText: 'Level 2!' });
    await expect(toast).toBeVisible(SLOW);
    await expect(toast).toContainText('+200');
  });

  // Challenge XP levelled players up silently too. Daily picks rotate by date,
  // so the clock is set to a day whose four include the one XP challenge
  // ("Play 5 Games") and no other game-count challenge.
  test('claiming a challenge\'s XP that levels up is toasted', async ({ page }) => {
    const day = [...Array(60).keys()]
      .map((i) => new Date(Date.UTC(2027, 0, 1 + i, 12)))
      .find((d) => {
        const ids = getDailyChallenges(d).map((c) => c.id);
        return ids.includes('d5') && !ids.includes('d4') && !ids.includes('d6');
      });
    expect(day, 'no day in range offers the XP challenge alone').toBeTruthy();
    await page.clock.setFixedTime(day);
    await bootToMainMenu(page);
    await seed(page, {
      level: 1, xp: 0, todayBattles: 5, dailyStatsDate: day.toDateString(), claimedChallenges: [],
    });
    await page.reload();
    await page.getByRole('button', { name: 'Challenges', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Challenges' });
    await dialog.getByRole('button', { name: 'Claim', exact: true }).click();
    const toast = page.locator('.toast-viewport > li').filter({ hasText: 'Level 2!' });
    await expect(toast).toBeVisible(SLOW);
    await expect(toast).toContainText('+200');
  });

  // The count-up and the bar honour reduced motion and the Animations switch:
  // the final figures at once. With motion allowed they count from zero.
  // The level-up row and the Battle Pass line too: Framer Motion's reduced
  // motion still ran their delayed opacity fades, so both sat invisible for
  // 1.6-1.9s after the panel opened.
  test('the rewards count up with motion, and show their final figures at once without it', async ({ page }) => {
    await bootToMainMenu(page);
    const xpFigure = (panel) => panel.locator('[data-count-up]').first();
    const levelsUpAtOnce = async (panel) => {
      await expect(panel.locator('[data-level-up]')).toHaveCSS('opacity', '1', { timeout: 400 });
      await expect(panel.locator('[data-pass-tier]')).toHaveCSS('opacity', '1', { timeout: 400 });
    };
    const aboutToLevel = { level: 1, xp: 95, seasonXP: 90, seasonKey: getCurrentSeason().key };

    // The suite runs with reduced motion (playwright.config).
    await seed(page, aboutToLevel);
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    let panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    expect(await xpFigure(panel).textContent()).toBe('20');
    await levelsUpAtOnce(panel);

    // Motion allowed: it starts below its figure and gets there.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await panel.getByRole('button', { name: 'Play Again' }).click();
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    expect(Number(await xpFigure(panel).textContent())).toBeLessThan(20);
    await expect(xpFigure(panel)).toHaveText('20', SLOW);

    // The Animations switch off, with the OS allowing motion: at once again.
    await seed(page, { animationsEnabled: false, ...aboutToLevel });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    expect(await xpFigure(panel).textContent()).toBe('20');
    await levelsUpAtOnce(panel);
  });
});

// The best jokes on the card, shown where it is read: the enlarged card under
// the mouse, the finger and the keyboard shows the flavor line (the card's
// description) with its rules, which the table has no room for. The caption's
// height is a model (previewPlacement.js captionHeight); previewPlacement.test.js
// holds it to measured heights, and this holds the rendered preview to its box.
test.describe('the preview\'s flavor line', () => {
  test.skip(!!process.env.E2E_PREVIEW, 'reads the card catalog from /src');
  // Cards whose flavor lines are the longest, so the caption is at its tallest.
  const LONG = [54, 52, 46, 59, 78, 17];
  const bootWithDeck = async (page) => {
    await bootToMainMenu(page);
    await seed(page, { currentDeck: LONG });
    await page.reload();
    await toBattle(page);
  };
  const catalog = (page, ids) => page.evaluate(async (wanted) => {
    const { ALL_CARDS } = await import('/src/stores/gameStore.js');
    return Object.fromEntries(wanted.map((id) => [id, ALL_CARDS.find((c) => c.id === id)]));
  }, ids);

  test('shows the card\'s own words under its rules, aria-hidden like the rest of the preview', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootWithDeck(page);
    const cards = await catalog(page, LONG);
    const hand = page.locator('[data-hand-id]').first();
    const name = await hand.getAttribute('aria-label');
    await hand.hover();
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveAttribute('aria-hidden', 'true');
    const flavor = preview(page).locator('[data-preview-flavor]');
    await expect(flavor).toBeVisible();
    const said = (await flavor.textContent()).replace(/^“|”$/g, '');
    expect(Object.values(cards).map((c) => c.description), `${name}: "${said}" is a card's own line`).toContain(said);
    // The words are the card's flavor, set apart from its rules by a hairline,
    // and a screen reader still meets the card as it always did.
    const style = await flavor.evaluate((el) => getComputedStyle(el).fontStyle);
    expect(style).toBe('italic');
  });

  // Each long-flavored card, at a small phone and a big one: the rendered
  // preview is no taller than the box the placement reserved, stays on the
  // felt and clear of the row it was opened from, and the rules always show.
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    test(`at ${viewport.width}x${viewport.height} every long-flavored card's preview stays inside its box, clear of its row`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize(viewport);
      await bootWithDeck(page);
      const felt = await page.locator('.felt-table').boundingBox();
      const hands = page.locator('[data-hand-id]');
      const count = await hands.count();
      expect(count).toBeGreaterThanOrEqual(5);
      let sawFlavor = 0;
      for (let i = 0; i < count; i += 1) {
        await page.mouse.move(0, 0);
        await expect(preview(page)).toHaveCount(0);
        await hands.nth(i).hover();
        await expect(preview(page)).toBeVisible();
        const outer = await preview(page).boundingBox();
        const inner = await preview(page).locator(':scope > div').boundingBox();
        const label = `card ${i} of the hand`;
        expect(inner.x, `${label}: out of its box on the left`).toBeGreaterThanOrEqual(outer.x - 1);
        expect(inner.y, `${label}: out of its box at the top`).toBeGreaterThanOrEqual(outer.y - 1);
        expect(inner.x + inner.width, `${label}: out of its box on the right`).toBeLessThanOrEqual(outer.x + outer.width + 1);
        expect(inner.y + inner.height, `${label}: out of its box at the bottom`).toBeLessThanOrEqual(outer.y + outer.height + 1);
        expect(inner.x, `${label}: off the felt`).toBeGreaterThanOrEqual(felt.x - 1);
        expect(inner.x + inner.width).toBeLessThanOrEqual(felt.x + felt.width + 1);
        expect(inner.y).toBeGreaterThanOrEqual(felt.y - 1);
        expect(inner.y + inner.height).toBeLessThanOrEqual(felt.y + felt.height + 1);
        if (await preview(page).locator('[data-preview-flavor]').count()) sawFlavor += 1;
        if (viewport.width >= 390) expect(await preview(page).locator('[data-preview-flavor]').count(), `${label}: the flavor is missing`).toBe(1);
      }
      expect(sawFlavor, 'at no size was any flavor line shown').toBeGreaterThan(0);
    });
  }

  test('a keyboard-opened preview carries the flavor and the keys, and stays clear of the focused card\'s row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootWithDeck(page);
    const first = page.getByRole('button', { name: /^Play / }).first();
    await first.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(preview(page)).toBeVisible();
    await expect(preview(page).locator('[data-preview-flavor]')).toBeVisible();
    await expect(preview(page)).toContainText('next card');
    await expect(preview(page).locator('[data-preview-keys]')).toBeVisible();
  });
});

// The Tab: the result panel's rewards, printed as a bar tab on thermal paper.
// The rows, the print, the footer's budget and what a screen reader hears are
// pinned here; what the panel says when it is a win, and that each game picks
// its own words, is in src/components/GameBoard/GameBoard.test.jsx.
test.describe('the Tab', () => {
  const concedeToTab = async (page) => {
    await toBattle(page);
    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await page.getByRole('button', { name: 'Concede', exact: true }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    const panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    return panel;
  };
  const bootWith = async (page, state = {}) => {
    await bootToMainMenu(page);
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4], totalDamageDealt: 4811, ...state });
    await page.reload();
  };

  test('prints the night as a list a screen reader reads row by row, and keeps "Battle Rewards"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootWith(page);
    const panel = await concedeToTab(page);
    await expect(panel.getByText('Battle Rewards', { exact: true })).toBeVisible();
    // The big title is for the eye alone.
    await expect(panel.getByText('THE TAB', { exact: true })).toHaveAttribute('aria-hidden', 'true');
    // Each row is a term and its figure ("Damage dealt, 0"), the leaders drawn
    // between them are not in the tree, and the figures say what they are.
    await expect(panel.getByRole('group', { name: 'Battle Rewards' })).toMatchAriaSnapshot(`
      - term: Cards played
      - definition: "1"
      - term: Damage dealt
      - definition: "0"
      - term: Healed
      - definition: "0"
      - term: Damage taken
      - definition: "0"
      - term: XP
      - definition: 20 XP
      - term: Coins
      - definition: 5 coins
    `);
    await expect(panel.getByRole('term').filter({ hasText: "CHUCK'S TAB" })).toBeVisible();
    await expect(panel.getByRole('definition').filter({ hasText: '4,81' })).toContainText('damage, still open');
    // And the figures are on the paper to the eye: four rows, then what it paid.
    for (const label of ['Cards played', 'Damage dealt', 'Healed', 'Damage taken', 'XP', 'Coins']) {
      const box = await panel.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }).boundingBox();
      expect(box.height, `${label} is on the paper`).toBeGreaterThan(10);
    }
  });

  // Below 700px tall the four itemized rows leave the screen so Play Again
  // stays within reach, and stay in the tree: the same receipt is read.
  test('hands the four itemized rows to screen readers alone on a short screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await bootWith(page);
    const panel = await concedeToTab(page);
    for (const label of ['Cards played', 'Damage dealt', 'Healed', 'Damage taken']) {
      const term = panel.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) });
      await expect(term, `${label} is still in the tree`).toBeAttached();
      // The row is the 1px clipped box; its term inside is clipped by it.
      const box = await term.locator('..').boundingBox();
      expect(box.width * box.height, `${label} is off the paper`).toBeLessThanOrEqual(4);
    }
    for (const label of ['XP', 'Coins', "CHUCK'S TAB"]) {
      const box = await panel.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }).boundingBox();
      expect(box.height, `${label} stays on the paper`).toBeGreaterThan(10);
    }
    // 700 on the dot is still short; 701 is not.
    await page.setViewportSize({ width: 390, height: 701 });
    const box = await panel.getByRole('term').filter({ hasText: /^Healed$/ }).boundingBox();
    expect(box.height, 'at 701px tall the rows are back').toBeGreaterThan(10);
  });

  test('prints in over 900 ms in 14 steps, with the slot already its full height; reduced motion simply shows it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await bootWith(page);
    const panel = await concedeToTab(page);
    const paper = panel.locator('.receipt');
    const feed = panel.locator('[data-bar-tab]');
    const css = await paper.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, duration: cs.animationDuration, timing: cs.animationTimingFunction };
    });
    expect(css).toEqual({ name: 'receipt-print', duration: '0.9s', timing: 'steps(14)' });
    // Sampled a frame at a time from here to the end of the print: it moves
    // (a transform, on the compositor), ends at rest, and the slot it prints
    // in is the same height throughout, so nothing below it jumps.
    const frames = await feed.evaluate((slot) => new Promise((resolve) => {
      const sheet = slot.querySelector('.receipt');
      const seen = [];
      const stop = performance.now() + 1300;
      const tick = () => {
        seen.push({ height: slot.getBoundingClientRect().height, transform: getComputedStyle(sheet).transform });
        if (performance.now() < stop) requestAnimationFrame(tick); else resolve(seen);
      };
      tick();
    }));
    expect(new Set(frames.map((f) => f.height)).size, 'the slot changed height while it printed').toBe(1);
    expect(frames[0].height).toBeGreaterThan(200);
    // (At rest it holds the last keyframe, an identity matrix, rather than none.)
    const atRest = (transform) => transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
    expect(frames.some((f) => !atRest(f.transform)), 'it never moved').toBe(true);
    expect(atRest(frames[frames.length - 1].transform), 'it did not come to rest').toBe(true);
    // The steps: a printer's chatter, not a slide (14 distinct places at most).
    expect(new Set(frames.map((f) => f.transform)).size).toBeLessThanOrEqual(15);
  });

  for (const how of [
    { name: 'reduced motion', media: 'reduce', animationsEnabled: true },
    { name: 'the Animations switch off', media: 'no-preference', animationsEnabled: false },
  ]) {
    test(`appears at once with ${how.name}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: how.media });
      await bootWith(page, { animationsEnabled: how.animationsEnabled });
      const panel = await concedeToTab(page);
      const paper = await panel.locator('.receipt').evaluate((el) => {
        const cs = getComputedStyle(el);
        return { name: cs.animationName, transform: cs.transform };
      });
      expect(paper).toEqual({ name: 'none', transform: 'none' });
    });
  }

  // 320px: the narrowest the receipt is drawn for. A row is one line (the
  // widest is Chuck's, bold, with an eight-digit bill), and the longest footer
  // the budget allows (44 characters, of long words) takes two.
  test('at 320px no row wraps, and the longest footer takes two lines', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await bootWith(page, { totalDamageDealt: 12_345_678 });
    const panel = await concedeToTab(page);
    const rows = await panel.locator('[data-bar-tab] dl > div').evaluateAll((els) => els.map((el) => ({
      label: el.querySelector('dt').textContent, height: Math.round(el.getBoundingClientRect().height),
    })));
    for (const row of rows) expect(row.height, `${row.label} wraps`).toBeLessThanOrEqual(24);
    const footer = panel.locator('[data-bar-tab] p').last();
    await footer.evaluate((el) => { el.textContent = 'Thank you for your business. Not you, Chuck.'; });
    const lines = await footer.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(lines, 'a 44-character footer needs more than two receipt lines at 320px').toBeLessThanOrEqual(2);
    // Nothing on the paper runs past it.
    const spill = await panel.locator('.receipt').evaluate((paper) => {
      const box = paper.getBoundingClientRect();
      return [...paper.querySelectorAll('*')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 1 && r.height > 1)
        .map((r) => Math.max(0, box.left - r.left, r.right - box.right));
    });
    expect(Math.max(0, ...spill), 'something on the receipt runs past the paper').toBeLessThanOrEqual(1);
  });

  test('has no axe violations printed in full: the level bar, a level-up, a tier and the shop nudge too', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootWith(page, { level: 1, xp: 95, seasonXP: 90, seasonKey: getCurrentSeason().key, gems: 0, cardPacks: 0 });
    const panel = await concedeToTab(page);
    await expect(panel.locator('[data-level-up]')).toBeVisible();
    await expect(panel.locator('[data-pass-tier]')).toBeVisible();
    await expectNoAxeViolations(page, 'the Tab with a level-up, a Battle Pass tier and the shop nudge');
  });
});

// Last call: the first time either side is down to LAST_CALL_HP, the house
// lights come up. The rule itself (once a game, who, the banner's order) is
// pinned against the real board in src/components/GameBoard/GameBoard.test.jsx;
// what only a browser can say is here: that it happens for real, that the
// room and the felt light without anything moving, how the stylesheet fades
// them, and that no line Chuck can say is cut off in his bubble.
test.describe('last call', () => {
  // The number the comeback achievement is advertised at. The store cannot be
  // imported here (Node has no "@/" alias), and gameStore.test.js pins the
  // constant, so this is the same figure written out.
  const LAST_CALL_HP = 5;
  const T0 = new Date('2027-01-15T22:00:00-05:00');
  test.use({ timezoneId: 'America/New_York', viewport: { width: 1280, height: 800 } });

  const lit = (page) => page.locator('.game-surface[data-last-call]').count().then((n) => n > 0);
  const healthNow = async (page) => Number((await page.locator('[aria-label^="Your health"]').getAttribute('aria-label')).match(/: (\d+) of/)[1]);
  // The page clock is faked, and jumped forward by hand so a round of the
  // fight takes no real time. It is stepped by 100 ms so the page renders (and
  // sets its next timer) between steps, as it would running for real. (It is
  // not paused: a paused clock also stalls the menu's own hand-off to the board.)
  const runClock = async (page, ms) => { for (let t = 0; t < ms; t += 100) await page.clock.runFor(100); };
  // Steps the page clock until the player has their turn back (End Turn is
  // there to press), or the game is lost.
  const untilMyTurn = async (page) => {
    for (let step = 0; step < 60; step += 1) {
      if (await page.getByRole('dialog', { name: 'Defeat' }).count()) return 'defeat';
      if (await page.getByRole('button', { name: 'End Turn' }).count()) return 'turn';
      await page.clock.runFor(100);
    }
    return 'timeout';
  };
  // End Turn, then step until the round is over, or the lights come up (when
  // they are not up already) or the game is lost, whichever comes first: the
  // banner is up for 1.3 s of page time, so the stepping stops while it is.
  const endTurnAndWatch = async (page, { stopAtLights = true } = {}) => {
    await page.getByRole('button', { name: 'End Turn' }).click();
    for (let step = 0; step < 40; step += 1) {
      await page.clock.runFor(100);
      if (stopAtLights && await lit(page)) return 'lit';
      if (await page.getByRole('dialog', { name: 'Defeat' }).count()) return 'defeat';
      if (step > 3 && await page.getByRole('button', { name: 'End Turn' }).count()) return 'turn';
    }
    return 'timeout';
  };

  // The player does nothing but end turns. With Math.random pinned, Chuck's
  // crew is fixed, and it hits for a few points a round, so the health walks
  // down 30, 30, 26, 22 ... and lands in the last-call range (1-5) before it
  // reaches 0. (A crew that skipped the range would fail the test by name.)
  const startFight = async (page) => {
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await page.clock.install({ time: T0 });
    await bootToMainMenu(page);
    await page.getByRole('button', { name: 'Battle', exact: true }).click();
    // The board is a lazy chunk, which arrives on real time; then the draw
    // takes half a second of the page's.
    await expect(page.getByRole('heading', { name: /^Battle against/ })).toBeAttached(SLOW);
    await runClock(page, 1200);
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
  };

  test('the lights come up once, at the HP the comeback is advertised at, and the room is lit without a card moving', async ({ page }) => {
    test.setTimeout(120_000);
    await startFight(page);
    // Every last-call line the log is ever given, counted as it is written.
    await page.evaluate(() => {
      window.__lastCalls = [];
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.textContent?.startsWith('Last call.')) window.__lastCalls.push(node.textContent);
          }
        }
      }).observe(document.querySelector('[role="log"]'), { childList: true, subtree: true });
    });
    const felt = await page.locator('.felt-table').boundingBox();

    const trail = [await healthNow(page)];
    let outcome = 'turn';
    for (let round = 0; round < 20 && outcome === 'turn'; round += 1) {
      expect(await lit(page), `the room was lit with ${trail[trail.length - 1]} HP`).toBe(false);
      outcome = await endTurnAndWatch(page);
      trail.push(await healthNow(page));
    }
    const hp = trail[trail.length - 1];
    expect(outcome, `the health went ${trail.join(', ')}: the lights never came up before the defeat`).toBe('lit');
    expect(hp, 'it came up with the player in range').toBeGreaterThan(0);
    expect(hp).toBeLessThanOrEqual(LAST_CALL_HP);
    expect(trail[trail.length - 2], 'and not a round sooner than it had to').toBeGreaterThan(LAST_CALL_HP);

    // The log says so (it is the accessible record), once, and Chuck says a
    // line of his own after it.
    const entries = page.locator('[role="log"] > div');
    await expect(entries.filter({ hasText: /^Last call\./ })).toHaveText(`Last call. House lights up — you're down to ${hp} HP.`);
    const spoken = (await entries.allTextContents()).filter((text) => QUIPS.lastCall.some((line) => text === `\u{1F9F8} Chuck: "${line}"`));
    expect(spoken, 'Chuck says a lastCall line').toHaveLength(1);
    // The banner is the turn banner's place, and aria-hidden.
    const banner = page.locator('[data-banner="last-call"]');
    await expect(banner).toHaveText('Last call');
    expect(await banner.evaluate((el) => Boolean(el.closest('[aria-hidden="true"]')))).toBe(true);

    // The room and the lamp over the felt are lit, under the content, and the
    // felt is the size it was.
    const layers = await page.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector));
      return {
        room: { opacity: style('.house-lights').opacity, z: style('.house-lights').zIndex, hidden: document.querySelector('.house-lights').getAttribute('aria-hidden') },
        lamp: { opacity: style('.felt-lamp').opacity, z: style('.felt-lamp').zIndex, hidden: document.querySelector('.felt-lamp').getAttribute('aria-hidden') },
        content: style('.game-surface > .relative.z-10').zIndex,
      };
    });
    expect(layers.room).toEqual({ opacity: '1', z: '0', hidden: 'true' });
    expect(layers.lamp).toEqual({ opacity: '1', z: '-1', hidden: 'true' });
    expect(Number(layers.content), 'the room is under all the content').toBeGreaterThan(Number(layers.room.z));
    const feltNow = await page.locator('.felt-table').boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) expect(feltNow[key], `the felt's ${key}`).toBeCloseTo(felt[key], 0);
    await expectNoAxeViolations(page, 'the board with the house lights up');

    // On to the defeat: the same game does not call last call again, and the
    // lights stay up under the result.
    outcome = await untilMyTurn(page);
    for (let round = 0; round < 20 && outcome === 'turn'; round += 1) {
      outcome = await endTurnAndWatch(page, { stopAtLights: false });
    }
    const defeat = page.getByRole('dialog', { name: 'Defeat' });
    await expect(defeat).toBeVisible(SLOW);
    expect(await page.evaluate(() => window.__lastCalls)).toHaveLength(1);
    expect(await lit(page)).toBe(true);

    // Play Again is a new night.
    await defeat.getByRole('button', { name: 'Play Again' }).click();
    await runClock(page, 1200);
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    expect(await lit(page)).toBe(false);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.house-lights')).opacity)).toBe('0');
  });

  // The stylesheet's half: nothing in the board's layout is the lights'. Set by
  // hand, the same board, the same moment, before and after.
  test('lighting the room moves nothing: the felt, both rows and the hand keep their boxes', async ({ page }) => {
    await bootToMainMenu(page);
    await seed(page, { currentDeck: [4, 4, 4, 4, 4, 4] });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Play Bar-Fight Barry' }).first().click();
    await expect(page.locator('[data-field="player"]')).toHaveCount(1, SLOW);
    await page.waitForTimeout(600);
    const geometry = () => page.evaluate(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100); };
      return {
        felt: box(document.querySelector('.felt-table')),
        rows: [...document.querySelectorAll('[data-field]')].map(box),
        hand: [...document.querySelectorAll('[data-hand-id]')].map(box),
        centre: document.documentElement.style.getPropertyValue('--battle-centre-y'),
        zoom: getComputedStyle(document.querySelector('[data-field="player"]').parentElement).zoom,
      };
    });
    const dark = await geometry();
    await page.evaluate(() => document.querySelector('.game-surface').setAttribute('data-last-call', ''));
    await page.waitForTimeout(300);
    expect(await geometry()).toEqual(dark);
    // The lamp is a layer of the felt itself, out of the grid's flow.
    const lamp = await page.locator('.felt-lamp').evaluate((el) => ({ position: getComputedStyle(el).position, inFelt: el.parentElement.classList.contains('felt-table') }));
    expect(lamp).toEqual({ position: 'absolute', inFelt: true });
    await expectNoAxeViolations(page, 'the board with the lights up and a creature on the table');
  });

  // 800 ms in, with motion allowed. With the Animations switch off, or reduced
  // motion, the lights are simply on: the fade rules sit outside Tailwind's
  // layer, and a rule that merely ties the lit state's specificity once left
  // reduced motion fading anyway.
  const FADES = [
    { name: 'with motion allowed', media: 'no-preference', animationsEnabled: true, duration: '0.8s', atOnce: false },
    { name: 'with the Animations switch off', media: 'no-preference', animationsEnabled: false, duration: '0s', atOnce: true },
    { name: 'with reduced motion', media: 'reduce', animationsEnabled: true, duration: '0s', atOnce: true },
  ];
  for (const fade of FADES) {
    test(`the house lights ${fade.atOnce ? 'are simply on' : 'fade in over 800 ms'} ${fade.name}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: fade.media });
      await bootToMainMenu(page);
      await seed(page, { animationsEnabled: fade.animationsEnabled });
      await page.reload();
      await toBattle(page);
      const opacities = () => page.evaluate(() => ({
        room: getComputedStyle(document.querySelector('.house-lights')).opacity,
        lamp: getComputedStyle(document.querySelector('.felt-lamp')).opacity,
      }));
      expect(await opacities()).toEqual({ room: '0', lamp: '0' });
      await page.evaluate(() => document.querySelector('.game-surface').setAttribute('data-last-call', ''));
      const first = await page.evaluate(() => ({
        duration: getComputedStyle(document.querySelector('.house-lights')).transitionDuration,
        lampDuration: getComputedStyle(document.querySelector('.felt-lamp')).transitionDuration,
      }));
      expect(first).toEqual({ duration: fade.duration, lampDuration: fade.duration });
      if (fade.atOnce) {
        expect(await opacities()).toEqual({ room: '1', lamp: '1' });
      } else {
        const early = await opacities();
        expect(Number(early.room), 'it is still coming up').toBeLessThan(1);
        await expect.poll(async () => (await opacities()).room, { timeout: 3000 }).toBe('1');
        expect(await opacities()).toEqual({ room: '1', lamp: '1' });
      }
    });
  }

  // Past midnight and before five, by the player's own clock, Chuck opens late.
  for (const { name, at, pool } of [
    { name: 'at 2:30 in the morning', at: '2027-01-15T02:30:00-05:00', pool: 'gameStartLate' },
    { name: 'in the afternoon', at: '2027-01-15T14:00:00-05:00', pool: 'gameStart' },
  ]) {
    test(`Chuck opens from the ${pool} pool ${name}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(at));
      await bootToMainMenu(page);
      await toBattle(page);
      const opener = page.locator('[role="log"] > div').filter({ hasText: /^\u{1F9F8} Chuck: /u }).first();
      await expect(opener).toBeAttached();
      const said = (await opener.textContent()).replace(/^\u{1F9F8} Chuck: "/u, '').slice(0, -1);
      expect(QUIPS[pool], `"${said}"`).toContain(said);
    });
  }

  // Chuck's bubble on the centre line holds two lines at 320px and clips the
  // rest. Characters are only a coarse guard (src/utils/teddyTalk.test.js); the
  // bubble is the measure: every line of every pool, set into the real one.
  test('every line Chuck can say fits his bubble at 320px, none cut off', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await bootToMainMenu(page);
    await toBattle(page);
    const lines = Object.entries(QUIPS).flatMap(([pool, list]) => list.map((text) => ({ pool, text })));
    const bubble = page.locator('[data-speech="opponent"]:visible').first();
    await expect(bubble).toBeVisible(SLOW);
    const cut = await bubble.evaluate((el, all) => {
      const words = [...el.childNodes].find((node) => node.nodeType === 3);
      return all
        .filter(({ text }) => { words.textContent = text; return el.scrollHeight > el.clientHeight + 1; })
        .map(({ pool, text }) => `${pool}: ${text}`);
    }, lines);
    expect(cut, 'lines the bubble cuts off at 320px').toEqual([]);
  });
});
