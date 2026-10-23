// The battle board's cards: how they read on the table and in the hand, how
// the hand fits a phone, how a touch screen plays a card, and what the result
// panel says about XP. Each test names the defect it pins.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, bootToMainMenu, SLOW } from './helpers/session.js';
import { getDailyChallenges } from '../src/stores/challenges.js';
import { getCurrentSeason } from '../src/utils/season.js';

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
  const chip = await sally.getByText('Warming Up').boundingBox();
  expect(chip.y).toBeGreaterThanOrEqual(card.y);
  expect(chip.y + chip.height).toBeLessThanOrEqual(card.y + card.height);
  const slot = await sally.boundingBox();
  expect(Math.abs(slot.height - card.height), 'the row reserves room below the card again').toBeLessThanOrEqual(1);
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
      return {
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
  test('the rewards count up with motion, and show their final figures at once without it', async ({ page }) => {
    await bootToMainMenu(page);
    const xpFigure = (panel) => panel.locator('[data-count-up]').first();

    // The suite runs with reduced motion (playwright.config).
    await toBattle(page);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    let panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    expect(await xpFigure(panel).textContent()).toBe('20');

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
    await seed(page, { animationsEnabled: false });
    await page.reload();
    await toBattle(page);
    await page.getByRole('button', { name: 'Concede' }).click();
    await page.getByRole('button', { name: 'Concede — counts as a loss' }).click();
    panel = page.getByRole('dialog', { name: 'Defeat' });
    await expect(panel).toBeVisible(SLOW);
    expect(await xpFigure(panel).textContent()).toBe('20');
  });
});
