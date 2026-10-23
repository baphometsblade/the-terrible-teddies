// The password-reset screens' decisions, kept pure so they can be tested
// without a browser or a backend: what to tell the player after asking for a
// reset link, and what a failed password change means. ForgotPassword.jsx
// and PasswordRecovery.jsx carry them out; both load on demand, and so does
// this. What a landing URL is (needed on first paint) is authLanding.js.
import { PASSWORD_MIN_LENGTH } from './authLanding';

export { PASSWORD_MIN_LENGTH };

// Supabase's default gap between two reset emails to one address. The form
// waits this long before it offers to send again, so a second tap cannot
// send a second email (and meet the server's own refusal, which would read
// as a failure).
export const RESEND_COOLDOWN_MS = 60_000;

/**
 * What to tell the player after asking for a reset link.
 *
 * 'sent' for ANY answer the server gave, refusals included: Supabase rate
 * limits per address, so "too many requests" for one email and silence for
 * another would say which of them has an account. Only a request that never
 * got an answer (no connection, or a gateway in front of Supabase failing,
 * which does not depend on any account) is 'offline', worth trying again.
 *
 * @returns {'sent'|'offline'}
 */
export function resetRequestOutcome(error) {
  if (!error) return 'sent';
  return error.name === 'AuthRetryableFetchError' ? 'offline' : 'sent';
}

/**
 * The form's own check of a new password, before anything is sent.
 * @returns {null|'too-short'|'mismatch'}
 */
export function newPasswordProblem(password, confirmation) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) return 'too-short';
  if (password !== confirmation) return 'mismatch';
  return null;
}

export const NEW_PASSWORD_PROBLEM_TEXT = {
  'too-short': `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  mismatch: 'The two passwords don\'t match.',
};

const EXPIRED_CODES = new Set(['session_not_found', 'session_expired', 'bad_jwt', 'user_not_found', 'refresh_token_not_found']);

/**
 * What a failed updateUser({ password }) means for the panel.
 *
 *   expired  the reset session is gone: the link has to be asked for again.
 *            The panel drops that dead session and turns into the
 *            expired-link screen, which says so in its own words, so this
 *            kind carries no message of its own.
 *   same     Supabase refuses the account's current password
 *   weak     Supabase's own strength rules (shown in its words, which name
 *            what is missing)
 *   offline  no answer: try again
 *   other    anything else
 *
 * @returns {{kind: string, message: string}}
 */
export function passwordChangeError(error) {
  const code = error?.code;
  if (error?.name === 'AuthSessionMissingError' || EXPIRED_CODES.has(code) || error?.status === 401 || error?.status === 403) {
    return { kind: 'expired', message: null };
  }
  if (code === 'same_password') {
    return { kind: 'same', message: 'That is the password this account already has. Choose a different one.' };
  }
  if (error?.name === 'AuthWeakPasswordError' || code === 'weak_password') {
    return { kind: 'weak', message: error.message || 'That password is too easy to guess. Try a longer one.' };
  }
  if (error?.name === 'AuthRetryableFetchError') {
    return { kind: 'offline', message: 'Couldn\'t reach the server. Check your connection and try again.' };
  }
  return { kind: 'other', message: 'Couldn\'t change your password just now. Please try again.' };
}

/**
 * The way on from a link that could not be used. It depends on whether this
 * device is still signed in, which is not known until the stored session has
 * been restored, and for a returning player that is a network refresh (their
 * access token has expired). Offering either way before then meant the copy
 * and the button changed under the player's finger, and a tap on "Send a new
 * link" could land a player who was signed in all along in the game.
 *
 *   'wait'     still restoring: say so, offer neither
 *   'game'     signed in: carry on
 *   'sign-in'  signed out: ask for a new link, or go back to sign in
 *
 * @returns {'wait'|'game'|'sign-in'}
 */
export function linkErrorWayOn({ restoring, signedIn }) {
  if (restoring) return 'wait';
  return signedIn ? 'game' : 'sign-in';
}
