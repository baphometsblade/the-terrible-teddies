// What a page load arrived with from an auth email, read by
// integrations/supabase/auth.jsx before supabase-js consumes the address.
// Pure, so it is tested without a browser (passwordRecovery.test.js), and
// apart from passwordRecovery.js because it is on everyone's first paint
// while the rest of the reset flow loads with its screens.

// The sign-up rule (Auth.jsx's password field). The set-new-password panel
// holds a new password to exactly what an account was created with; Supabase
// may be configured to ask for more, and its refusal is shown as it words it.
export const PASSWORD_MIN_LENGTH = 6;

const params = (href) => {
  let url;
  try {
    url = new URL(href);
  } catch {
    return new URLSearchParams();
  }
  // Supabase answers in the fragment (the implicit flow this app uses) and,
  // for some errors, in the query; the fragment wins where both say.
  const merged = new URLSearchParams(url.search);
  for (const [k, v] of new URLSearchParams(url.hash.replace(/^#/, ''))) merged.set(k, v);
  return merged;
};

const AUTH_ERROR_PARAMS = ['error', 'error_code', 'error_description', 'sb'];

/**
 * What a page load arrived with:
 *
 *   { kind: 'recovery' }            a password-reset link: Supabase signed the
 *                                   player in to set a new password
 *   { kind: 'link-error', code }    an email link Supabase refused (expired,
 *                                   already used, or otherwise invalid)
 *   null                            an ordinary visit
 *
 * An error does not say which kind of email link it came from, so the copy
 * built on it must hold for any of them.
 */
export function landingFromUrl(href) {
  const p = params(href);
  if (p.get('error') || p.get('error_code') || p.get('error_description')) {
    return { kind: 'link-error', code: p.get('error_code') || p.get('error') || 'unknown' };
  }
  if (p.get('type') === 'recovery' && p.get('access_token')) return { kind: 'recovery' };
  return null;
}

/**
 * Whether the page arrived from an auth email at all (either flow). Only such
 * a tab reacts to PASSWORD_RECOVERY: supabase-js relays auth events to the
 * game's other open tabs, which must not all turn into the reset panel.
 */
export function landedFromAuthLink(href) {
  if (landingFromUrl(href)) return true;
  return params(href).has('code');
}

/**
 * The address without the error Supabase put in it (supabase-js clears a
 * successful link's tokens itself, but leaves an error), so a reload does not
 * show the expired-link panel again. Everything else in the URL is kept.
 */
export function withoutAuthError(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const search = new URLSearchParams(url.search);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const k of AUTH_ERROR_PARAMS) { search.delete(k); hash.delete(k); }
  const q = search.toString();
  const h = hash.toString();
  return `${url.pathname}${q ? `?${q}` : ''}${h ? `#${h}` : ''}`;
}

/**
 * Why the recovery link could not be used, from supabase-js's
 * initialize() result: 'offline' when it never reached the server (the link
 * is still in the address, so a reload can try it again), else 'invalid'.
 */
export function recoveryLinkFailure(error) {
  return error?.name === 'AuthRetryableFetchError' ? 'offline' : 'invalid';
}

/**
 * A page load's landing, kept until the reset flow it started is over.
 *
 * Read from the address once, at module load (supabase-js consumes the
 * address itself soon after), and that read outlives the provider that acts
 * on it: the crash screen's Try Again remounts the provider, which would
 * otherwise find the same landing and bring the reset panel back over a game
 * whose password was changed minutes ago. consume() says the flow has ended,
 * after which this load is an ordinary visit.
 */
export function landingRecord(href) {
  const landing = landingFromUrl(href);
  const fromAuthLink = landedFromAuthLink(href);
  let consumed = false;
  return {
    /** What the load arrived with (see landingFromUrl), null once consumed. */
    get landing() { return consumed ? null : landing; },
    /** Whether the load came from an auth email, false once consumed. */
    get fromAuthLink() { return !consumed && fromAuthLink; },
    consume() { consumed = true; },
  };
}

/**
 * Where the sign-in screen should open next, given what was asked for: a
 * signed-in player is not shown the sign-in screen at all, so for them there
 * is nowhere to open, and an intent kept anyway would open the reset form
 * unasked at their next sign-out.
 *
 * @returns {null|'forgot'}
 */
export const signInIntent = (intent, signedIn) => (signedIn ? null : intent ?? null);
