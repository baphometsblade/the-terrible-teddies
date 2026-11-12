// Shared hermetic-session setup for the Playwright suites.
//
// Fully hermetic: a fake Supabase session is seeded into localStorage before
// the app boots (supabase-js restores it from the `sb-<ref>-auth-token` key),
// and every request to the fake Supabase project and to PostHog is stubbed or
// aborted in the browser. Sounds, card art and fonts are the app's own files,
// served with it (src/utils/sounds.test.js fails on an external sound URL).
// No real backend is contacted.
//
// Factored out of e2e/smoke.spec.js so e2e/a11y.spec.js (and any future spec)
// can reuse the exact same boot without duplicating it or drifting from it.
import { test as base, expect } from '@playwright/test';
// The door's storage contract, from the same pure module the app reads it with.
import { DOOR_KEY, doorRecord } from '../../src/lib/door.js';
import { CONSENT_KEY, consentRecord } from '../../src/lib/consent.js';
import { arrivalChip } from '../../src/lib/abilities.js';

export const REF = 'testproject'; // first host label of VITE_SUPABASE_URL

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const FAKE_JWT = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', exp: 4102444800 }),
  'sig',
].join('.');

export const SESSION = {
  access_token: FAKE_JWT,
  token_type: 'bearer',
  expires_in: 3600 * 24 * 365,
  expires_at: 4102444800,
  refresh_token: 'fake-refresh',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'qa@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
};

// Generous ceiling for lazy-loaded dialogs and battle animations.
export const SLOW = { timeout: 30_000 };

// `test` extended with the same auto-collected page-error fixture the smoke
// suite asserts against, so any spec importing this can reuse it too.
//
// And with the door. A device that has never answered the adults-only door
// (src/components/TheDoor.jsx) sees nothing else, so every spec's context is
// seeded with a pass before any page loads (a context-level init script: it
// reaches the specs that boot themselves, and the pages they open, which
// bootToMainMenu alone would not). It is written only where there is no
// record yet, so an answer the app has stored since is never overwritten by a
// reload. e2e/door.spec.js turns it off with `test.use({ doorPassed: false })`
// to meet the door as a new device does. Contexts a spec makes for itself
// with browser.newContext() are not seeded: they are new devices.
export const test = base.extend({
  doorPassed: [true, { option: true }],
  // The cookie bar covers the bottom of the menu. Specs that are not about
  // the choice start with it already made, the way the door is seeded.
  consentGranted: [true, { option: true }],
  context: async ({ context, doorPassed, consentGranted }, use) => {
    if (doorPassed) {
      await context.addInitScript(([key, value]) => {
        try {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        } catch {
          // No storage to write to (about:blank, blocked): the page is not one that reads it.
        }
      }, [DOOR_KEY, doorRecord('pass', 0)]);
    }
    if (consentGranted) {
      await context.addInitScript(([key, value]) => {
        try {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        } catch {
          // Same as the door: a page with no storage is not one that reads it.
        }
      }, [CONSENT_KEY, consentRecord('granted', 0)]);
    }
    await use(context);
  },
  // The opening mulligan sits in front of turn 1. Specs that start a fight
  // wait for End Turn, which is the turn after Keep hand. This presses Keep
  // whenever it is up, so those specs still land on the fight. A spec that
  // wants the mulligan itself can click before this poll, or not use it.
  //
  // It presses with a dispatched click, not a mouse click. This runs in the
  // background, beside whatever the spec is doing, and a real click moves
  // the mouse onto Keep hand and the focus into it; Keep hand then unmounts
  // and the focus falls to <body>. A spec asserting where the focus is (a
  // battle opens on its heading) failed whenever this landed after the app
  // had placed the focus, and a spec in the middle of its own pointer moves
  // (hover a card, then click a target) could have the mouse taken from
  // under it. A dispatched click runs the same onClick and touches neither.
  // One press at a time: two overlapping ticks both saw the button and both
  // pressed.
  page: async ({ page }, use) => {
    let stopped = false;
    let busy = false;
    const timer = setInterval(() => {
      if (stopped || busy) return;
      busy = true;
      const keep = page.getByRole('button', { name: 'Keep hand' });
      keep.isVisible()
        .then((visible) => (visible && !stopped ? keep.dispatchEvent('click', undefined, { timeout: 1000 }) : undefined))
        .catch(() => {})
        .finally(() => { busy = false; });
    }, 150);
    await use(page);
    stopped = true;
    clearInterval(timer);
  },
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err));
      await use(errors);
    },
    { auto: true },
  ],
});

// Stubs every request to the fake Supabase project (answering as a signed-in
// player's backend would) and aborts PostHog's.
export async function stubSupabase(page) {
  await page.route('**testproject.supabase.co/**', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/user')) return route.fulfill({ json: SESSION.user });
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });
    if (url.includes('/rest/v1/rpc/')) return route.fulfill({ json: null });
    if (url.includes('/rest/v1/')) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  await page.route('https://*.posthog.com/**', (r) => r.abort());
}

// Seeds the fake auth session and a deterministic game store for the next
// load. lastLoginDate=today and tutorialCompleted=true suppress the first-run
// Daily Rewards / Tutorial modals so tests land on the main menu.
export async function seedSignedIn(page) {
  await page.addInitScript(
    ([authKey, session]) => {
      localStorage.setItem(authKey, JSON.stringify(session));
      localStorage.setItem(
        'terrible-teddies-storage',
        JSON.stringify({
          state: {
            tutorialCompleted: true,
            lastLoginDate: new Date().toDateString(),
            playerName: 'QA Bear',
            coins: 1234,
            gems: 56,
          },
          version: 3,
        })
      );
    },
    [`sb-${REF}-auth-token`, SESSION]
  );
}

// Stubs the fake Supabase project + analytics, seeds the fake
// auth session and a deterministic game store, then boots the app and waits
// for the main menu. Call from a `test.beforeEach`.
export async function bootToMainMenu(page) {
  await stubSupabase(page);
  await seedSignedIn(page);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
}

// The marketing page stands in front of the age door for a brand-new device.
// A home-screen shortcut and a password-reset link skip it. Everything else
// that wants the door clicks through. The pointer is moved off afterwards so
// it does not land on the date field and start a hover transition.
export async function passTheLanding(page) {
  const enter = page.getByRole('button', { name: "I'm old enough. Check the door." });
  const door = page.getByRole('heading', { name: 'ID.', level: 1 });
  await expect(enter.or(door)).toBeVisible(SLOW);
  if (await enter.isVisible()) {
    await enter.click();
    await page.mouse.move(0, 0);
  }
}

// The status chips of creatures that sat down this turn. arrivalChip
// (src/lib/abilities.js) labels most "Warming Up" and a Quickie (rush)
// "Quickie". Chuck's opener is drawn from a shuffled crew, and in about one
// fight in thirty on easy it is a Quickie, so a count of exact "Warming Up"
// chips that included the opener came up one short. Exact, so the cards'
// screen-reader descriptions, which say the same words, are not counted.
export const SICK_CHIP = new RegExp(`^(${arrivalChip({})}|${arrivalChip({ ability: 'rush' })})$`);
export const sickChips = (scope) => scope.getByText(SICK_CHIP);
// A just-played creature of the player's: their own row, so Chuck's draw
// cannot change the count.
export const playerWarmingUp = (page) => page.locator('[data-field="player"]').getByText(arrivalChip({}), { exact: true });

// A line of speech on the table, read once it has been up for `after` ms of
// the page's own time, and measured in the same frame.
//
// Chuck's quip and the player's emote are taken down by a timer (3.2 s and
// 3.5 s). Chuck speaks at the deal, before the opening mulligan, so a spec
// that waited for End Turn first and then looked for the bubble raced that
// timer against however long Keep hand and the draw took on a loaded
// machine, and lost now and then. This waits in the page (polling on
// animation frames), counts from when the line first showed, and returns
// everything the spec checks in that one frame, so nothing can expire
// between the look and the measurement. Start it before the step that makes
// the line appear and await it after.
//
// Returns { text, over, clipped }: the line's text; every visible speech
// element as "speaker over N card(s)"; and, when `lines` is given, the ones
// that would be clipped if set in this element at its own maximum width.
export const settledSpeech = (page, who, { after = 400, lines = null, timeout = 30_000 } = {}) => page.waitForFunction(
  ({ who: speaker, after: wait, lines: texts }) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const el = [...document.querySelectorAll(`[data-speech="${speaker}"]`)].find(visible);
    if (!el) return false;
    window.__speechSeen ??= new WeakMap();
    const seen = window.__speechSeen.get(el) ?? performance.now();
    window.__speechSeen.set(el, seen);
    if (performance.now() - seen < wait) return false;

    const over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const cards = [...document.querySelectorAll('[data-field]')].map((c) => c.getBoundingClientRect());
    const placed = [...document.querySelectorAll('[data-speech]')].filter(visible).map((s) => {
      const box = s.getBoundingClientRect();
      return `${s.dataset.speech} over ${cards.filter((c) => over(box, c)).length} card(s)`;
    });

    let clipped = null;
    if (texts) {
      const centre = el.parentElement.parentElement; // the pill's max-width is the centre line's
      const probe = el.cloneNode(true);
      probe.removeAttribute('data-speech');
      Object.assign(probe.style, { position: 'absolute', left: '0', top: '0', visibility: 'hidden', transform: 'none' });
      centre.appendChild(probe);
      const icon = probe.firstElementChild;
      clipped = [];
      for (const text of texts) {
        probe.replaceChildren(icon, document.createTextNode(text));
        if (probe.scrollHeight > probe.clientHeight + 1 || probe.scrollWidth > probe.clientWidth + 1) clipped.push(text);
      }
      probe.remove();
    }
    return { text: el.textContent, over: placed, clipped };
  },
  { who, after, lines },
  { timeout, polling: 'raf' },
).then((handle) => handle.jsonValue());

export { expect };
