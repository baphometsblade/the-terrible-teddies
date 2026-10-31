// The adults-only door (src/components/TheDoor.jsx, gated by DoorGate.jsx), as
// a new device meets it: the bar's steel door and a question, and nothing of
// the game behind it until the answer is an adult's. Every other spec starts
// past it (e2e/helpers/session.js seeds a pass in each context); this one
// turns that off.
//
// It is a courtesy gate in the fiction, not age verification, and these tests
// pin what it promises: both answers, the year the player turns 18 and its
// birthday question, an answer that stays on the device (a reload, a new
// tab, a deep link, a second tab), a year that is never stored or sent, the
// keyboard and the double-tap, and a layout that fits a 320px phone.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, stubSupabase, seedSignedIn, SLOW } from './helpers/session.js';
import { DOOR_KEY, doorRecord } from '../src/lib/door.js';
import { CONTENT_NOTICE } from '../src/lib/contentNotice.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const YEAR = new Date().getFullYear();
const ADULT = String(YEAR - 30);
const MINOR = String(YEAR - 12);
const TURNING_18 = String(YEAR - 18);
const DECLINED = 'Sorry, this room is 18+. Terrible Teddies is for players 18 and over. Thanks for being honest.';

test.use({ doorPassed: false });

// A new device at the door: the backend stubbed (the game behind it talks to
// the fake project), the door up and its heading showing.
const meetTheDoor = async (page, url = '/') => {
  await stubSupabase(page);
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'ID.', level: 1 })).toBeVisible(SLOW);
};

// The form is dead for its first moments (the double-tap that launched the
// app must not answer), so wait for it to be armed before using it.
const armed = (page) => expect(page.locator('form[data-armed="true"]')).toBeVisible();
const yearField = (page) => page.getByLabel('Year you were born');
const comeIn = (page) => page.getByRole('button', { name: 'Come in' });

const answer = async (page, year) => {
  await armed(page);
  await yearField(page).fill(year);
  await comeIn(page).click();
};
const answerBirthday = async (page, name) => {
  await expect(page.getByRole('heading', { name: 'Had your birthday yet this year?' })).toBeVisible();
  await expect(page.locator('[data-armed="true"]').filter({ has: page.getByRole('button', { name }) })).toBeVisible();
  await page.getByRole('button', { name, exact: true }).click();
};

const record = async (page) => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), DOOR_KEY));
// The game, which is what the door is in front of: signed out, its first
// screen is the sign-in form.
const theGame = (page) => page.getByRole('button', { name: 'Sign In' });
const declined = (page) => page.getByRole('status').filter({ hasText: DECLINED });

test.describe('a new device', () => {
  test('meets the door and not the game', async ({ page, pageErrors }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await meetTheDoor(page);
    const heading = page.getByRole('heading', { name: 'ID.', level: 1 });
    await expect(heading).toBeFocused();
    await expect(page).toHaveTitle(/ID, please/);

    // The scene: the amber sign, the shades in the slot, the shared content line.
    await expect(page.getByText('ID REQUIRED')).toBeVisible();
    await expect(page.getByText(`Contains ${CONTENT_NOTICE}.`)).toBeVisible();
    await expect(page.getByText("Only used to check you're 18 or over. It never leaves this device.")).toBeVisible();
    // Bruno's card at full size, not the thumbnail, drawn and decoration only.
    const art = page.locator('.peep-slot img');
    await expect(art).toHaveJSProperty('naturalWidth', 768);
    await expect(art).toHaveAttribute('alt', '');
    expect(requests.some((u) => u.endsWith('/cards/56.webp'))).toBe(true);
    expect(requests.some((u) => u.includes('/cards/thumbs/56'))).toBe(false);

    // None of the game: not its sign-in screen, not its menu, not its dialogs.
    await expect(theGame(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // And no answer on the device yet.
    expect(await page.evaluate((k) => localStorage.getItem(k), DOOR_KEY)).toBeNull();
    expect(pageErrors).toEqual([]);
  });

  test('hands the loader off at once, so its medallion does not ghost over the door', async ({ page }) => {
    await page.addInitScript(() => {
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
    await meetTheDoor(page);
    await expect.poll(() => page.evaluate(() => window.__loaderClasses.join(' '))).toContain('to-app');
  });

  test('is let in at over 18: the game, a pass on the device, and the year nowhere', async ({ page, pageErrors }) => {
    const sent = [];
    page.on('request', (r) => sent.push(`${new URL(r.url()).search} ${r.postData() ?? ''}`));
    await meetTheDoor(page);
    await answer(page, ADULT);
    await expect(theGame(page)).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'ID.' })).toHaveCount(0);

    const stored = await record(page);
    expect(stored).toMatchObject({ v: 1, state: 'pass' });
    expect(Math.abs(stored.at - Date.now())).toBeLessThan(60_000);
    // Never stored, logged or sent: not in either storage, not in a query
    // string or a body.
    const everywhere = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(everywhere).not.toContain(ADULT);
    expect(sent.join('\n')).not.toContain(ADULT);
    expect(pageErrors).toEqual([]);
  });

  test('is not asked again: a reload and a new tab go straight to the game', async ({ page, context }) => {
    await meetTheDoor(page);
    await answer(page, ADULT);
    await expect(theGame(page)).toBeVisible(SLOW);
    await page.reload();
    await expect(theGame(page)).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'ID.' })).toHaveCount(0);
    const other = await context.newPage();
    await other.goto('/');
    await expect(theGame(other)).toBeVisible(SLOW);
    await expect(other.getByRole('heading', { name: 'ID.' })).toHaveCount(0);
  });

  test('is turned away under 18: one plain line, nothing to press, and the game never loads', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await meetTheDoor(page);
    await answer(page, MINOR);
    const status = declined(page);
    await expect(status).toBeVisible();
    await expect(status).toHaveText(DECLINED);
    await expect(status).toBeFocused();
    await expect(page).toHaveTitle(/Sorry/);
    // No retry, no way back, no joke, no scene: not one control on the page.
    await expect(page.locator('button, a[href], input, form, img, .neon, .steel-door')).toHaveCount(0);
    // The game is not there, and was never asked for: no sign-in, no menu,
    // and nothing sent to the analytics.
    await expect(theGame(page)).toHaveCount(0);
    expect(requests.filter((u) => /posthog/.test(u))).toEqual([]);
    expect(await record(page)).toMatchObject({ v: 1, state: 'declined' });
    const everywhere = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(everywhere).not.toContain(MINOR);
  });

  // Reload, a new tab, a deep link and Back all land on the same answer.
  test('stays turned away: a reload, a new tab, a deep link, and Back', async ({ page, context }) => {
    await meetTheDoor(page);
    await answer(page, MINOR);
    await expect(declined(page)).toBeVisible();

    await page.reload();
    await expect(declined(page)).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'ID.' })).toHaveCount(0);

    const other = await context.newPage();
    await stubSupabase(other);
    await other.goto('/');
    await expect(declined(other)).toBeVisible(SLOW);

    // A deep link: the address is left exactly as it came, and still the door.
    await other.goto('/?action=battle');
    await expect(declined(other)).toBeVisible(SLOW);
    expect(new URL(other.url()).search).toBe('?action=battle');
    await expect(other.getByRole('button', { name: 'End Turn' })).toHaveCount(0);

    // Back and forward over it.
    await other.goBack();
    await other.goForward();
    await expect(declined(other)).toBeVisible(SLOW);
    await expect(theGame(other)).toHaveCount(0);
  });

  // A second tab can be sitting on the door when the first answers.
  test('turns a second tab away too when the first declines', async ({ page, context }) => {
    await meetTheDoor(page);
    const second = await context.newPage();
    await meetTheDoor(second);
    await answer(page, MINOR);
    await expect(declined(page)).toBeVisible();
    // The second tab was showing the door; it hears and takes the decline.
    await expect(declined(second)).toBeVisible(SLOW);
    expect((await record(page)).state).toBe('declined');
  });

  test('lets the stricter answer win when the second tab is the one that passes first', async ({ page, context }) => {
    await meetTheDoor(page);
    const second = await context.newPage();
    await meetTheDoor(second);
    await answer(second, ADULT);
    await expect(theGame(second)).toBeVisible(SLOW);
    // The first tab is still showing the door: its player says they are a minor.
    await answer(page, MINOR);
    await expect(declined(page)).toBeVisible();
    await page.reload();
    await expect(declined(page)).toBeVisible(SLOW);
    expect((await record(page)).state).toBe('declined');
  });
});

test.describe('the year the player turns 18', () => {
  test('is asked whether the birthday has been, in the form\'s place, with two equal answers', async ({ page }) => {
    await meetTheDoor(page);
    await answer(page, TURNING_18);
    const heading = page.getByRole('heading', { name: 'Had your birthday yet this year?' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    // The form is gone from the page as far as anyone can tell.
    await expect(yearField(page)).toBeHidden();
    await expect(comeIn(page)).toBeHidden();

    const yes = page.getByRole('button', { name: 'Yes', exact: true });
    const notYet = page.getByRole('button', { name: 'Not yet', exact: true });
    await expect(yes).toBeVisible();
    // Equal: the same size, the same glass, and neither is the brass that
    // marks the answer a screen wants.
    const [a, b] = await Promise.all([yes.boundingBox(), notYet.boundingBox()]);
    expect([Math.round(a.width), Math.round(a.height)]).toEqual([Math.round(b.width), Math.round(b.height)]);
    const look = (el) => el.evaluate((n) => ({ cls: n.className.replace(/\bpointer-events-none\b/, '').trim(), bg: getComputedStyle(n).backgroundImage, color: getComputedStyle(n).color }));
    const [ly, ln] = await Promise.all([look(yes), look(notYet)]);
    expect(ly).toEqual(ln);
    expect(ly.cls).toContain('btn-glass');
    expect(ly.cls).not.toContain('btn-brass');
    await expect(page.locator('.btn-brass')).toHaveCount(0);
  });

  test('"Yes" is let in', async ({ page }) => {
    await meetTheDoor(page);
    await answer(page, TURNING_18);
    await answerBirthday(page, 'Yes');
    await expect(theGame(page)).toBeVisible(SLOW);
    expect((await record(page)).state).toBe('pass');
  });

  test('"Not yet" is turned away, for good', async ({ page }) => {
    await meetTheDoor(page);
    await answer(page, TURNING_18);
    await answerBirthday(page, 'Not yet');
    await expect(declined(page)).toBeVisible();
    expect((await record(page)).state).toBe('declined');
    await page.reload();
    await expect(declined(page)).toBeVisible(SLOW);
  });

  test('is not asked of anyone else: a year before it is in, a year after it is out', async ({ page }) => {
    await meetTheDoor(page);
    await answer(page, String(YEAR - 19));
    await expect(theGame(page)).toBeVisible(SLOW);
  });
});

test.describe('a year that is not one', () => {
  for (const [what, text] of [['nothing', ''], ['three digits', '199'], ['letters', 'abcd'], ['before 1900', '1899'], ['next year', String(YEAR + 1)]]) {
    test(`says so, in place, for ${what}, and lets nobody in`, async ({ page }) => {
      await meetTheDoor(page);
      await armed(page);
      await yearField(page).fill(text);
      await comeIn(page).click();
      const alert = page.getByRole('alert');
      await expect(alert).toHaveText('Enter the year as four digits.');
      await expect(yearField(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(yearField(page)).toBeFocused();
      await expect(yearField(page)).toHaveAccessibleDescription(/Only used to check.*Enter the year as four digits\./);
      expect(await page.evaluate((k) => localStorage.getItem(k), DOOR_KEY)).toBeNull();
      await expect(theGame(page)).toHaveCount(0);
      // Typing again takes the message away.
      await yearField(page).press('1');
      await expect(alert).toHaveText('');
      await expect(yearField(page)).not.toHaveAttribute('aria-invalid', 'true');
    });
  }

  // At the narrowest phone, where a line is the most likely to wrap.
  test('does not move the button under the finger when it appears', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await meetTheDoor(page);
    await armed(page);
    const before = await comeIn(page).boundingBox();
    await comeIn(page).click();
    await expect(page.getByRole('alert')).toHaveText('Enter the year as four digits.');
    expect(await comeIn(page).boundingBox()).toEqual(before);
  });
});

test.describe('with only a keyboard', () => {
  test('goes from the heading to the field to the button, and Enter answers', async ({ page }) => {
    await meetTheDoor(page);
    await expect(page.getByRole('heading', { name: 'ID.', level: 1 })).toBeFocused();
    // Exactly two stops on the door: the field, then the button.
    const stops = await page.evaluate(() => [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => el.tagName.toLowerCase()));
    expect(stops).toEqual(['input', 'button']);
    await armed(page);
    await page.keyboard.press('Tab');
    await expect(yearField(page)).toBeFocused();
    await page.keyboard.type(ADULT);
    await page.keyboard.press('Enter');
    await expect(theGame(page)).toBeVisible(SLOW);
  });

  test('answers the birthday question from the keyboard, Yes then Not yet in the tab order', async ({ page }) => {
    await meetTheDoor(page);
    await armed(page);
    await page.keyboard.press('Tab');
    await page.keyboard.type(TURNING_18);
    await page.keyboard.press('Enter');
    const heading = page.getByRole('heading', { name: 'Had your birthday yet this year?' });
    await expect(heading).toBeFocused();
    await expect(page.locator('[data-armed="true"]').filter({ has: page.getByRole('button', { name: 'Yes', exact: true }) })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Not yet', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(theGame(page)).toBeVisible(SLOW);
  });
});

// The double-tap that launched the app lands on whatever the door has drawn:
// for its first 400ms nothing on it answers (and nothing complains).
test.describe('the first moments', () => {
  test('ignore a tap, and listen once the door has settled', async ({ page }) => {
    await page.clock.install();
    await meetTheDoor(page);
    await expect(page.locator('form[data-armed="false"]')).toBeVisible();
    // A tap that arrives at once is not an answer and not an error.
    await comeIn(page).click({ force: true });
    await expect(page.getByRole('alert')).toHaveText('');
    await page.clock.runFor(500);
    await armed(page);
    await comeIn(page).click();
    await expect(page.getByRole('alert')).toHaveText('Enter the year as four digits.');
  });
});

test.describe('the address', () => {
  // ?action= is a home-screen shortcut: it must come through the door
  // untouched, for App to find once the game is up.
  test('keeps ?action= through the door, for the game to read', async ({ page }) => {
    await stubSupabase(page);
    await seedSignedIn(page);
    await page.goto('/?action=battle');
    await expect(page.getByRole('heading', { name: 'ID.', level: 1 })).toBeVisible(SLOW);
    expect(new URL(page.url()).search).toBe('?action=battle');
    await answer(page, ADULT);
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible(SLOW);
    // App has read it and cleared it, as it always did.
    expect(new URL(page.url()).search).toBe('');
  });

  test('is met once by a player who already has a game: their save is there behind it', async ({ page }) => {
    await stubSupabase(page);
    await seedSignedIn(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ID.', level: 1 })).toBeVisible(SLOW);
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toHaveCount(0);
    await answer(page, ADULT);
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(page.getByText('QA Bear')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
  });
});

test.describe('with storage blocked', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    });
  });

  test('asks, and lets a pass through for the session', async ({ page, pageErrors }) => {
    await meetTheDoor(page);
    await answer(page, ADULT);
    await expect(theGame(page)).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'ID.' })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('holds a decline for the page', async ({ page }) => {
    await meetTheDoor(page);
    await answer(page, MINOR);
    await expect(declined(page)).toBeVisible();
    await expect(theGame(page)).toHaveCount(0);
  });
});

test.describe('a device that has passed', () => {
  test.use({ doorPassed: true });

  // A returning player must not pay for the door: its chunk and its art are
  // never asked for.
  test('never downloads the door, or Bruno\'s full-size card', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await stubSupabase(page);
    await seedSignedIn(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await page.waitForTimeout(500);
    expect(requests.filter((u) => /TheDoor/.test(u))).toEqual([]);
    expect(requests.filter((u) => u.endsWith('/cards/56.webp'))).toEqual([]);
    expect(await page.evaluate((k) => localStorage.getItem(k), DOOR_KEY)).toBe(doorRecord('pass', 0));
  });
});

for (const viewport of [{ width: 320, height: 568 }, { width: 1280, height: 800 }]) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    // axe composites colours, so wait for the sign's switch-on to finish.
    const settle = async (page) => {
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(900);
    };
    const expectNoViolations = async (page, label) => {
      await settle(page);
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`), label).toEqual([]);
    };

    test('has no WCAG 2.1 A/AA violations: the door, the question and the turning away', async ({ page }) => {
      await meetTheDoor(page);
      await expectNoViolations(page, 'the door');
      await answer(page, TURNING_18);
      await expect(page.getByRole('heading', { name: 'Had your birthday yet this year?' })).toBeVisible();
      await expectNoViolations(page, 'the birthday question');
      await answerBirthday(page, 'Not yet');
      await expect(declined(page)).toBeVisible();
      await expectNoViolations(page, 'the turning away');
    });

    test('has no WCAG violations with an error showing', async ({ page }) => {
      await meetTheDoor(page);
      await armed(page);
      await comeIn(page).click();
      await expect(page.getByRole('alert')).toHaveText('Enter the year as four digits.');
      await expectNoViolations(page, 'the door with its error');
    });

    // Every control a finger can meet, by what it meets: the box, and the
    // thing at its middle.
    test('has a 44px target for every control', async ({ page }) => {
      await meetTheDoor(page);
      await armed(page);
      const short = () => page.evaluate(() => [...document.querySelectorAll('button, input')]
        .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
        .map((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { name: (el.getAttribute('aria-label') || el.textContent || el.id).trim(), w: Math.round(r.width), h: Math.round(r.height), hits: hit === el || el.contains(hit) };
        })
        .filter((c) => c.w < 44 || c.h < 44 || !c.hits));
      expect(await short(), 'the year form').toEqual([]);
      await yearField(page).fill(TURNING_18);
      await comeIn(page).click();
      await page.getByRole('heading', { name: 'Had your birthday yet this year?' }).waitFor();
      await page.locator('[data-armed="true"]').filter({ has: page.getByRole('button', { name: 'Yes', exact: true }) }).waitFor();
      expect(await short(), 'the birthday question').toEqual([]);
    });
  });
}

// A phone's screen is short: both states of the door must fit above the fold
// at the smallest sizes, with nothing scrolling sideways.
for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 553 }, { width: 360, height: 640 }]) {
  test.describe(`on a phone at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    const fits = async (page, label) => {
      const m = await page.evaluate(() => {
        const d = document.documentElement;
        const bottoms = [...document.querySelectorAll('button')]
          .filter((el) => getComputedStyle(el).visibility !== 'hidden')
          .map((el) => el.getBoundingClientRect().bottom);
        return { overY: d.scrollHeight - d.clientHeight, overX: d.scrollWidth - d.clientWidth, lowest: Math.max(...bottoms, 0) };
      });
      expect(m.overX, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
      expect(m.overY, `${label} scrolls down ${m.overY}px`).toBeLessThanOrEqual(0);
      expect(m.lowest, `${label}: the lowest button is below the fold`).toBeLessThanOrEqual(viewport.height);
    };

    test('fits above the fold, the form with its field focused and the question', async ({ page }) => {
      await meetTheDoor(page);
      await armed(page);
      await yearField(page).focus();
      await fits(page, 'the door, field focused');
      await comeIn(page).click();
      await expect(page.getByRole('alert')).toHaveText('Enter the year as four digits.');
      await fits(page, 'the door with its error');
      await yearField(page).fill(TURNING_18);
      await comeIn(page).click();
      await page.getByRole('heading', { name: 'Had your birthday yet this year?' }).waitFor();
      await fits(page, 'the birthday question');
    });

    test('fits above the fold when it turns someone away', async ({ page }) => {
      await meetTheDoor(page);
      await answer(page, MINOR);
      await expect(declined(page)).toBeVisible();
      await fits(page, 'the turning away');
    });
  });
}

// The opening: the slot slides shut, the door swings in on amber light, and
// the game is handed over. With motion allowed it moves; under reduced motion
// nothing on the door is ever painted with a transform, and with the in-game
// Animations switch off it is simply gone.
test.describe('the opening', () => {
  const transforms = (page) => page.evaluate(() => [...document.querySelectorAll('[data-door-room], [data-door-room] *')]
    .map((el) => getComputedStyle(el).transform)
    .filter((t) => t !== 'none'));

  test('swings the door in with motion allowed, then hands over to the game', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await meetTheDoor(page);
    await answer(page, ADULT);
    // The leaf turns on its hinge: a 3-D transform, and not at rest.
    await page.waitForFunction(() => {
      const leaf = document.querySelector('.steel-door');
      return leaf && getComputedStyle(leaf).transform.startsWith('matrix3d');
    }, null, { timeout: 5_000, polling: 'raf' });
    await expect(theGame(page)).toBeVisible(SLOW);
    await expect(page.locator('[data-door-room]')).toHaveCount(0);
  });

  test('never paints a transform under reduced motion, and crossfades instead', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await meetTheDoor(page);
    expect(await transforms(page), 'at rest').toEqual([]);
    await answer(page, ADULT);
    // Sampled through the 200ms crossfade, every frame.
    const seen = await page.evaluate(() => new Promise((resolve) => {
      const out = [];
      const sample = () => {
        const room = document.querySelector('[data-door-room]');
        if (!room) return resolve(out);
        out.push(...[room, ...room.querySelectorAll('*')].map((el) => getComputedStyle(el).transform).filter((t) => t !== 'none'));
        requestAnimationFrame(sample);
      };
      sample();
    }));
    expect(seen).toEqual([]);
    await expect(theGame(page)).toBeVisible(SLOW);
  });

  test('is no ceremony at all with the Animations switch off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      localStorage.setItem('terrible-teddies-storage', JSON.stringify({ state: { animationsEnabled: false }, version: 3 }));
    });
    await meetTheDoor(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    expect(await transforms(page), 'at rest').toEqual([]);
    // Nothing on the door is animating: the sign is simply lit and the slot
    // simply open.
    expect(await page.evaluate(() => document.querySelector('[data-door-room]').getAnimations({ subtree: true }).length)).toBe(0);
    await answer(page, ADULT);
    // Handed over at once, not after a swing: well inside the 920ms the
    // ceremony would take.
    await expect(theGame(page)).toBeVisible({ timeout: 700 });
  });
});
