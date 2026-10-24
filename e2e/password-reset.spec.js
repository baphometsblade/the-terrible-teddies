// Password reset, end to end, with Supabase's auth endpoints stubbed: asking
// for a link from the sign-in screen, landing from one (a recovery session),
// setting the new password, and a link that has expired.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, SESSION, REF, SLOW } from './helpers/session.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoAxeViolations(page, label) {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`), label).toEqual([]);
}

// Every request to the fake project, answered per test. `auth` records what
// the reset form and the panel sent.
async function stubBackend(page, { recover, updateUser, user, token } = {}) {
  const auth = { recover: [], updates: [] };
  await page.route(`**${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/auth/v1/recover')) {
      auth.recover.push({ url, body: req.postDataJSON() });
      return recover ? recover(route) : route.fulfill({ json: {} });
    }
    if (url.includes('/auth/v1/user') && req.method() === 'PUT') {
      auth.updates.push(req.postDataJSON());
      return updateUser ? updateUser(route) : route.fulfill({ json: SESSION.user });
    }
    if (url.includes('/auth/v1/user')) return user ? user(route) : route.fulfill({ json: SESSION.user });
    if (url.includes('/auth/v1/token') && token) return token(route);
    if (url.includes('/auth/v1/')) return route.fulfill({ json: SESSION });
    if (url.includes('/rest/v1/rpc/')) return route.fulfill({ json: null });
    if (url.includes('/rest/v1/')) return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  await page.route('https://*.posthog.com/**', (r) => r.abort());
  return auth;
}

// What Supabase redirects a reset email's link to (the implicit flow): the
// tokens of a session it has just signed the player in with, marked recovery.
const recoveryHash = () => {
  const now = Math.floor(Date.now() / 1000);
  return `#access_token=${SESSION.access_token}&expires_at=${now + 3600}&expires_in=3600`
    + `&refresh_token=fake-refresh&token_type=bearer&type=recovery`;
};
const EXPIRED_HASH = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

// Supabase Auth answers in its 2024-01-01 error shape ({ code, msg }) and
// says so in this header (exposed to the page, as Supabase's gateway does);
// without it supabase-js reads no error code at all.
const GOTRUE_2024 = {
  'x-supabase-api-version': '2024-01-01',
  'access-control-expose-headers': 'x-supabase-api-version',
};

// What every returning player has in storage: a session whose access token
// expired (they last an hour), so restoring it is a refresh round-trip.
const staleSession = () => {
  const past = Math.floor(Date.now() / 1000) - 7200;
  return { ...SESSION, expires_at: past, expires_in: 3600, refresh_token: 'stale-refresh' };
};
const seedStoredSession = (page, session) => page.addInitScript(([key, s]) => {
  localStorage.setItem(key, JSON.stringify(s));
  localStorage.setItem('terrible-teddies-storage', JSON.stringify({
    state: { tutorialCompleted: true, lastLoginDate: new Date().toDateString() }, version: 3,
  }));
}, [`sb-${REF}-auth-token`, session]);

// A request held until the test lets it go.
const gate = () => {
  let open;
  const opened = new Promise((r) => { open = r; });
  return { opened, open: () => open() };
};

const signInScreen = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible(SLOW);
};

test.describe('asking for a reset link', () => {
  test('sends one link for the email, back to this site, and says so neutrally', async ({ page, baseURL }) => {
    const auth = await stubBackend(page, {
      // Slow enough that the second tap lands while the first is out.
      recover: async (route) => { await new Promise((r) => setTimeout(r, 400)); return route.fulfill({ json: {} }); },
    });
    await signInScreen(page);
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByRole('button', { name: 'Forgot password?' }).click();

    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    // The email typed for signing in comes along, and the field has focus.
    const field = page.getByLabel('Email');
    await expect(field).toHaveValue('qa@example.com');
    await expect(field).toBeFocused();
    await expectNoAxeViolations(page, 'reset form');

    const send = page.getByRole('button', { name: 'Send reset link' });
    await send.dblclick();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeFocused();

    expect(auth.recover).toHaveLength(1);
    expect(auth.recover[0].body.email).toBe('qa@example.com');
    // redirect_to: this site's origin, the address Supabase must allow-list.
    expect(new URL(auth.recover[0].url).searchParams.get('redirect_to')).toBe(new URL(baseURL).origin);

    await expect(page.getByText(/If an account exists for qa@example\.com/)).toBeVisible();
    // Not again for a minute: the button says when.
    const again = page.getByRole('button', { name: /^Send again in \d+s$/ });
    await expect(again).toHaveAttribute('aria-disabled', 'true');
    // Forced: Playwright will not click what says it is disabled, a player can.
    await again.click({ force: true });
    await page.waitForTimeout(300);
    expect(auth.recover).toHaveLength(1);
    await expectNoAxeViolations(page, 'reset link sent');

    // Back to the sign-in form, focus on the control that left it.
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeFocused();
  });

  // Supabase rate limits per address, so its refusal for one email and its
  // silence for another would say which has an account. The player is told
  // the same either way.
  test('answers a refusal exactly as it answers a send', async ({ page }) => {
    const texts = [];
    for (const recover of [
      (route) => route.fulfill({ json: {} }),
      (route) => route.fulfill({ status: 429, headers: GOTRUE_2024, json: { code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 60 seconds.' } }),
    ]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await stubBackend(page, { recover });
      await signInScreen(page);
      await page.getByRole('button', { name: 'Forgot password?' }).click();
      await page.getByLabel('Email').fill('someone@example.com');
      await page.getByRole('button', { name: 'Send reset link' }).click();
      const panel = page.locator('.dialog-panel');
      await expect(panel.getByRole('heading', { name: 'Check your email' })).toBeVisible();
      texts.push((await panel.innerText()).replace(/Send again in \d+s/, 'Send again in Ns'));
    }
    expect(texts[1]).toBe(texts[0]);
    expect(texts[1]).not.toMatch(/60 seconds|security purposes|rate/i);
  });

  test('says so when the request never reached the server, and lets it be tried again', async ({ page }) => {
    let fail = true;
    const auth = await stubBackend(page, { recover: (route) => (fail ? route.abort('internetdisconnected') : route.fulfill({ json: {} })) });
    await signInScreen(page);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('alert')).toContainText("Couldn't reach the server");
    await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(auth.recover.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('landing from a reset link', () => {
  test('opens the set-new-password panel in place of the game, and saves the new password', async ({ page }) => {
    const auth = await stubBackend(page);
    await page.goto(`/${recoveryHash()}`);
    const heading = page.getByRole('heading', { name: 'Set a New Password' });
    await expect(heading).toBeVisible(SLOW);
    // The game does not boot underneath it.
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('New password', { exact: true })).toBeFocused();
    // supabase-js has taken the tokens out of the address.
    expect(new URL(page.url()).hash).toBe('');
    await expect(page).toHaveTitle(/Reset Password/);
    await expectNoAxeViolations(page, 'set new password');

    // The form's own checks first: nothing is sent for them.
    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Confirm new password').fill('short');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('alert')).toHaveText('Use at least 6 characters.');
    await expect(page.getByLabel('New password', { exact: true })).toBeFocused();
    await page.getByLabel('New password', { exact: true }).fill('honeypot-9');
    await page.getByLabel('Confirm new password').fill('honeypit-9');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('alert')).toHaveText("The two passwords don't match.");
    await expect(page.getByLabel('Confirm new password')).toBeFocused();
    await expect(page.getByLabel('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.updates).toHaveLength(0);
    await expectNoAxeViolations(page, 'set new password, mismatch');

    await page.getByLabel('Confirm new password').fill('honeypot-9');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('heading', { name: 'Password Changed' })).toBeVisible();
    expect(auth.updates.map((u) => u.password)).toEqual(['honeypot-9']);
    const go = page.getByRole('button', { name: 'Continue to the game' });
    await expect(go).toBeFocused();
    await expectNoAxeViolations(page, 'password changed');

    // Signed in by the link: on into the game.
    await go.click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
  });

  test("shows Supabase's refusal and keeps the form", async ({ page }) => {
    await stubBackend(page, {
      updateUser: (route) => route.fulfill({ status: 422, headers: GOTRUE_2024, json: { code: 'same_password', msg: 'New password should be different from the old password.' } }),
    });
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible(SLOW);
    await page.getByLabel('New password', { exact: true }).fill('old-password');
    await page.getByLabel('Confirm new password').fill('old-password');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('alert')).toContainText('already has');
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    // Back in the field the refusal is about, ready to type over.
    await expect(page.getByLabel('New password', { exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Save new password' })).toBeVisible();
  });

  // The reset session can end before the player saves (they took too long,
  // or used the link elsewhere): Supabase answers 401, and the panel says
  // the link has expired rather than "something went wrong".
  test('sends the player for a new link when the reset session has gone', async ({ page }) => {
    await stubBackend(page, {
      updateUser: (route) => route.fulfill({ status: 401, headers: GOTRUE_2024, json: { code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' } }),
    });
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible(SLOW);
    await page.getByLabel('New password', { exact: true }).fill('honeypot-9');
    await page.getByLabel('Confirm new password').fill('honeypot-9');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible();
    // Supabase said the session is gone, so the panel does not claim the
    // player is still signed in: it offers the new link they came for, and
    // the dead session is no longer kept on this device.
    await expect(page.getByRole('button', { name: 'Send a new link' })).toBeFocused();
    await expect(page.getByText(/ask for a new link/)).toBeVisible();
    await expect(page.getByText(/still signed in/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue to the game' })).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), `sb-${REF}-auth-token`)).toBeNull();
  });

  // The crash screen's Try Again remounts everything under it, the auth
  // provider included. The reset link was read once, at load; it must not
  // bring the panel back over a game whose password has just been changed.
  test('does not come back once the reset is done, even when the app remounts', async ({ page }) => {
    test.skip(!!process.env.E2E_PREVIEW, 'reaches into the store module from /src');
    await stubBackend(page);
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible(SLOW);
    await page.getByLabel('New password', { exact: true }).fill('honeypot-9');
    await page.getByLabel('Confirm new password').fill('honeypot-9');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await page.getByRole('button', { name: 'Continue to the game' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);

    // A render crash in the game, then Try Again with the cause put right.
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/stores/gameStore.js');
      useGameStore.setState({ ownedCards: null, currentDeck: null, completedAchievements: null });
    });
    const tryAgain = page.getByRole('button', { name: /try again/i });
    await expect(tryAgain).toBeVisible(SLOW);
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/stores/gameStore.js');
      useGameStore.setState({ ownedCards: [], currentDeck: [], completedAchievements: [] });
    });
    await tryAgain.click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toHaveCount(0);
  });

  // supabase-js takes the tokens out of the address once it has used them,
  // so a reload, or a phone discarding the tab while the player fetches a
  // password from their password manager, dropped the panel and left them
  // in the game, signed in by the link, not knowing their password.
  test('comes back after a reload before the password is saved, and not once it is', async ({ page }) => {
    const auth = await stubBackend(page);
    await page.goto(`/${recoveryHash()}`);
    const heading = page.getByRole('heading', { name: 'Set a New Password' });
    await expect(heading).toBeVisible(SLOW);
    expect(new URL(page.url()).hash).toBe('');

    await page.reload();
    await expect(heading).toBeVisible(SLOW);
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('New password', { exact: true })).toBeFocused();

    await page.getByLabel('New password', { exact: true }).fill('honeypot-9');
    await page.getByLabel('Confirm new password').fill('honeypot-9');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('heading', { name: 'Password Changed' })).toBeVisible();
    expect(auth.updates.map((u) => u.password)).toEqual(['honeypot-9']);

    // Done: a reload now is an ordinary visit.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(heading).toHaveCount(0);
  });

  test('a reload after "Not now" is the game, and a new tab never resumes it', async ({ page, context }) => {
    await stubBackend(page);
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible(SLOW);
    // Per tab: another tab of the game is not the one the link opened.
    const other = await context.newPage();
    await stubBackend(other);
    await other.goto('/');
    await expect(other.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(other.getByRole('heading', { name: 'Set a New Password' })).toHaveCount(0);
    await other.close();

    await page.getByRole('button', { name: /Not now/ }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toHaveCount(0);
  });

  // Resumed after the reset session is gone (signed out elsewhere, say):
  // there is nothing to set a password on, so it says so before the player
  // types one, and offers the new link they need.
  test('a resumed panel with no session left offers a new link instead of the form', async ({ page }) => {
    await stubBackend(page);
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible(SLOW);
    await page.evaluate((key) => localStorage.removeItem(key), `sb-${REF}-auth-token`);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible(SLOW);
    await expect(page.getByRole('button', { name: 'Send a new link' })).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
  });
});

test.describe('a reset link that cannot be used', () => {
  // Supabase refuses the token (too old, revoked): nothing to set a password
  // with, and nothing worth keeping in the address.
  test('says so when Supabase refuses its token, and drops the token from the address', async ({ page }) => {
    await stubBackend(page, {
      user: (route) => route.fulfill({ status: 401, headers: GOTRUE_2024, json: { code: 'bad_jwt', msg: 'invalid JWT' } }),
    });
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'This Link Can’t Be Used' })).toBeVisible(SLOW);
    expect(new URL(page.url()).hash).toBe('');
    await expect(page.getByRole('button', { name: 'Send a new link' })).toBeFocused();
  });

  // The server could not be reached: the link has not been used, so it stays
  // in the address and a reload tries it again.
  test('keeps a link it could not check, to try again', async ({ page }) => {
    await stubBackend(page, { user: (route) => route.abort('internetdisconnected') });
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'Couldn’t Check Your Link' })).toBeVisible(SLOW);
    expect(new URL(page.url()).hash).toContain('type=recovery');
    await expect(page.getByRole('button', { name: 'Try the link again' })).toBeFocused();
    await expectNoAxeViolations(page, 'link could not be checked');
  });
});

test.describe('an expired link', () => {
  test('says so, takes the error out of the address, and offers a new link', async ({ page }) => {
    const auth = await stubBackend(page);
    await page.goto(`/${EXPIRED_HASH}`);
    await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible(SLOW);
    await expect(page.getByText(/expired or has already been used/)).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    const again = page.getByRole('button', { name: 'Send a new link' });
    await expect(again).toBeFocused();
    await expectNoAxeViolations(page, 'expired link');

    await again.click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible(SLOW);
    await expect(page.getByLabel('Email')).toBeFocused();
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(auth.recover).toHaveLength(1);

    // A reload is an ordinary visit now: the sign-in form, no panel.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toHaveCount(0);
  });

  // A returning player's stored session is restored with a network refresh,
  // and until it answers nobody knows whether they are signed in. The panel
  // used to guess "signed out" meanwhile: its copy and button then flipped
  // under the player, focus fell to the page, and a tap on "Send a new link"
  // in that window landed a signed-in player in the game, with the reset form
  // left waiting to open unasked at their next sign-out.
  test('waits for a returning player\'s session before offering a way on', async ({ page }) => {
    const refresh = gate();
    await stubBackend(page, {
      token: async (route) => { await refresh.opened; return route.fulfill({ json: SESSION }); },
    });
    await seedStoredSession(page, staleSession());
    await page.goto(`/${EXPIRED_HASH}`);
    await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible(SLOW);
    const panel = page.locator('.dialog-panel');
    await expect(panel.getByRole('status')).toContainText('Checking whether you’re still signed in');
    await expect(panel.getByRole('button')).toHaveCount(0);
    await expectNoAxeViolations(page, 'expired link, session restoring');
    // Slow to answer: it says why, as the boot screen does.
    await expect(panel.getByRole('status')).toContainText('Still trying to reach the server', { timeout: 10_000 });
    await expect(panel.getByRole('button')).toHaveCount(0);

    refresh.open();
    const go = page.getByRole('button', { name: 'Continue to the game' });
    await expect(go).toBeFocused(SLOW);
    await expect(page.getByText(/still signed in on this device/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send a new link' })).toHaveCount(0);

    await go.click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
    // Signing out later opens the sign-in form as usual, not the reset form.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible(SLOW);
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toHaveCount(0);
  });

  test('offers a new link once the restore finds the player signed out', async ({ page }) => {
    await stubBackend(page, {
      // The stored refresh token is no good any more.
      token: async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        return route.fulfill({ status: 400, headers: GOTRUE_2024, json: { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' } });
      },
    });
    await seedStoredSession(page, staleSession());
    await page.goto(`/${EXPIRED_HASH}`);
    await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible(SLOW);
    const again = page.getByRole('button', { name: 'Send a new link' });
    await expect(again).toBeFocused(SLOW);
    await expect(page.getByRole('button', { name: 'Continue to the game' })).toHaveCount(0);
    await again.click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible(SLOW);
  });

  // Signed in on this device already: nothing to send, just the way on.
  test('lets a player who is still signed in carry on', async ({ page }) => {
    await stubBackend(page);
    await page.addInitScript(([key, session]) => {
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem('terrible-teddies-storage', JSON.stringify({
        state: { tutorialCompleted: true, lastLoginDate: new Date().toDateString() }, version: 3,
      }));
    }, [`sb-${REF}-auth-token`, SESSION]);
    await page.goto(`/${EXPIRED_HASH}`);
    await expect(page.getByRole('heading', { name: 'This Link Has Expired' })).toBeVisible(SLOW);
    await expect(page.getByRole('button', { name: 'Send a new link' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue to the game' }).click();
    await expect(page.getByRole('button', { name: 'Battle', exact: true })).toBeVisible(SLOW);
  });
});

// How tall a target a finger meets, down the middle of a button: the run of
// points that land on it, which for "Forgot password?" includes its ::before.
const hitHeight = (locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  let top = null;
  let bottom = null;
  for (let y = Math.floor(r.top) - 30; y <= Math.ceil(r.bottom) + 30; y += 1) {
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === el || el.contains(hit))) {
      if (top === null) top = y;
      bottom = y;
    }
  }
  return top === null ? 0 : bottom - top + 1;
});

// The game holds every control to 44px. These are lines of small text, so
// each is padded out to it, without reaching over a neighbour.
for (const width of [320, 390]) {
  test(`the account screens' text buttons are 44px targets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await stubBackend(page);
    await signInScreen(page);

    const forgot = page.getByRole('button', { name: 'Forgot password?' });
    expect(await hitHeight(forgot), 'Forgot password?').toBeGreaterThanOrEqual(44);
    // Its hit area stops short of the password field above and Sign In below.
    const field = await page.getByLabel('Password', { exact: true }).boundingBox();
    const signIn = await page.getByRole('button', { name: 'Sign In' }).boundingBox();
    const owner = (y) => page.evaluate(([px, py]) => {
      const hit = document.elementFromPoint(px, py);
      return hit?.closest('button')?.textContent.trim() ?? hit?.tagName;
    }, [field.x + field.width - 20, y]);
    expect(await owner(field.y + field.height - 2)).toBe('INPUT');
    const signInOwner = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.textContent.trim(), [signIn.x + signIn.width / 2, signIn.y + 2]);
    expect(signInOwner).toBe('Sign In');

    await forgot.click();
    await page.getByLabel('Email').fill('qa@example.com');
    const back = page.getByRole('button', { name: 'Back to sign in' });
    expect((await back.boundingBox()).height, 'Back to sign in').toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    for (const name of [/^Send again/, 'Use a different email', 'Back to sign in']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box.height, String(name)).toBeGreaterThanOrEqual(44);
    }

    await page.goto('about:blank');
    await page.goto(`/${recoveryHash()}`);
    const notNow = page.getByRole('button', { name: 'Not now: continue to the game' });
    await expect(notNow).toBeVisible(SLOW);
    expect((await notNow.boundingBox()).height, 'Not now').toBeGreaterThanOrEqual(44);
  });
}

// The panel and the reset form, at the phone widths the rest of the game is
// checked at: no sideways scroll, and the primary action on screen.
for (const width of [320, 390]) {
  test(`the reset screens fit a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await stubBackend(page);
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    // Signed out first: the recovery link below signs the player in.
    await signInScreen(page);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeInViewport();
    expect(await fits(), 'the reset form scrolls sideways').toBe(true);
    // A real load: a goto that only changes the fragment would not reload.
    await page.goto('about:blank');
    await page.goto(`/${recoveryHash()}`);
    await expect(page.getByRole('heading', { name: 'Set a New Password' })).toBeVisible(SLOW);
    await expect(page.getByRole('button', { name: 'Save new password' })).toBeInViewport();
    expect(await fits(), 'the recovery panel scrolls sideways').toBe(true);
  });
}
