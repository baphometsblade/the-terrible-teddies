import { describe, it, expect } from 'vitest';
import {
  landingFromUrl, landedFromAuthLink, withoutAuthError, recoveryLinkFailure, PASSWORD_MIN_LENGTH,
  landingRecord, signInIntent,
} from './authLanding';
import {
  resetRequestOutcome, newPasswordProblem, passwordChangeError, linkErrorWayOn,
} from './passwordRecovery';

const ORIGIN = 'https://teddies.example';
// What Supabase redirects to: a recovery link signs the player in (implicit
// flow), an expired one carries the error instead.
const RECOVERY = `${ORIGIN}/#access_token=eyJ.x.y&expires_at=1900000000&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery`;
const EXPIRED = `${ORIGIN}/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;

describe('what a page load arrived with', () => {
  it('knows a password-reset link', () => {
    expect(landingFromUrl(RECOVERY)).toEqual({ kind: 'recovery' });
  });

  it('knows a refused link, by its code, from the fragment or the query', () => {
    expect(landingFromUrl(EXPIRED)).toEqual({ kind: 'link-error', code: 'otp_expired' });
    expect(landingFromUrl(`${ORIGIN}/?error=server_error&error_description=Oops`)).toEqual({ kind: 'link-error', code: 'server_error' });
    expect(landingFromUrl(`${ORIGIN}/#error_description=Something`)).toEqual({ kind: 'link-error', code: 'unknown' });
  });

  it('is an ordinary visit otherwise', () => {
    for (const href of [
      `${ORIGIN}/`,
      `${ORIGIN}/?purchase=success&session_id=cs_1`,
      `${ORIGIN}/?action=battle`,
      // A sign-in link (magic link, sign-up confirmation) is not a reset.
      `${ORIGIN}/#access_token=eyJ.x.y&refresh_token=r&token_type=bearer&type=signup`,
      // type=recovery with no token is not a session to set a password with.
      `${ORIGIN}/#type=recovery`,
      'not a url',
    ]) expect(landingFromUrl(href), href).toBeNull();
  });

  // supabase-js relays auth events to other open tabs; only the tab the link
  // opened should become the reset panel.
  it('tells a tab opened by an auth email from any other', () => {
    expect(landedFromAuthLink(RECOVERY)).toBe(true);
    expect(landedFromAuthLink(EXPIRED)).toBe(true);
    expect(landedFromAuthLink(`${ORIGIN}/?code=abc123`)).toBe(true);
    expect(landedFromAuthLink(`${ORIGIN}/`)).toBe(false);
    expect(landedFromAuthLink(`${ORIGIN}/?purchase=cancelled`)).toBe(false);
  });

  // The landing is read once per page load, and the provider acting on it
  // can mount more than once (the crash screen's Try Again remounts it).
  it('is an ordinary visit once the reset flow it started has ended', () => {
    const record = landingRecord(RECOVERY);
    expect(record.landing).toEqual({ kind: 'recovery' });
    expect(record.landing).toEqual({ kind: 'recovery' });
    expect(record.fromAuthLink).toBe(true);
    record.consume();
    expect(record.landing).toBeNull();
    expect(record.fromAuthLink).toBe(false);
    expect(landingRecord(EXPIRED).landing).toEqual({ kind: 'link-error', code: 'otp_expired' });
    expect(landingRecord(`${ORIGIN}/`).landing).toBeNull();
  });

  it('drops only the error from the address, so a reload does not show it again', () => {
    expect(withoutAuthError(EXPIRED)).toBe('/');
    expect(withoutAuthError(`${ORIGIN}/play?action=shop&error=x&error_code=otp_expired#error_description=y&keep=1`))
      .toBe('/play?action=shop#keep=1');
    expect(withoutAuthError('not a url')).toBe('not a url');
  });
});

describe('asking for a reset link', () => {
  // Supabase rate limits per address. Showing its refusal for one email and
  // nothing for another would say which has an account.
  it('says "sent" for every answer the server gives, refusals included', () => {
    expect(resetRequestOutcome(null)).toBe('sent');
    for (const error of [
      { name: 'AuthApiError', status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 60 seconds.' },
      { name: 'AuthApiError', status: 400, code: 'validation_failed', message: 'Unable to validate email address: invalid format' },
      { name: 'AuthApiError', status: 422, code: 'user_not_found', message: 'User not found' },
      { name: 'AuthUnknownError', status: 500 },
    ]) expect(resetRequestOutcome(error), error.code ?? error.name).toBe('sent');
  });

  it('says "offline" only when the request got no answer', () => {
    expect(resetRequestOutcome({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })).toBe('offline');
    expect(resetRequestOutcome({ name: 'AuthRetryableFetchError', status: 503 })).toBe('offline');
  });
});

describe('a new password', () => {
  it('follows the sign-up rule', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
    expect(newPasswordProblem('12345', '12345')).toBe('too-short');
    expect(newPasswordProblem('', '')).toBe('too-short');
    expect(newPasswordProblem(undefined, undefined)).toBe('too-short');
    expect(newPasswordProblem('123456', '123456')).toBeNull();
  });

  it('must be typed the same twice', () => {
    expect(newPasswordProblem('honeypot', 'honeypit')).toBe('mismatch');
    expect(newPasswordProblem('honeypot', 'honeypot')).toBeNull();
  });
});

describe('a failed password change', () => {
  it('sends the player for a new link when the reset session is gone', () => {
    for (const error of [
      { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
      { name: 'AuthApiError', status: 401, code: 'bad_jwt' },
      { name: 'AuthApiError', status: 403, code: 'session_not_found' },
      { name: 'AuthApiError', status: 404, code: 'user_not_found' },
    ]) expect(passwordChangeError(error).kind, error.code ?? error.name).toBe('expired');
  });

  it('names a refusal of the current password', () => {
    const e = passwordChangeError({ name: 'AuthApiError', status: 422, code: 'same_password', message: 'New password should be different from the old password.' });
    expect(e).toEqual({ kind: 'same', message: expect.stringMatching(/already has/) });
  });

  // Supabase's message names which of its rules the password missed.
  it('passes on Supabase\'s own words for a weak password', () => {
    const message = 'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, 0123456789.';
    expect(passwordChangeError({ name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', message })).toEqual({ kind: 'weak', message });
    expect(passwordChangeError({ name: 'AuthApiError', code: 'weak_password', message: '' }).message).toMatch(/too easy to guess/);
  });

  it('tells no answer from a refusal', () => {
    expect(passwordChangeError({ name: 'AuthRetryableFetchError', status: 0 }).kind).toBe('offline');
    expect(passwordChangeError({ name: 'AuthApiError', status: 500, code: 'unexpected_failure' }).kind).toBe('other');
    expect(passwordChangeError(undefined).kind).toBe('other');
  });

  it('tells a link that could not be checked from one that is dead', () => {
    expect(recoveryLinkFailure({ name: 'AuthRetryableFetchError', status: 0 })).toBe('offline');
    expect(recoveryLinkFailure({ name: 'AuthApiError', status: 401, code: 'bad_jwt' })).toBe('invalid');
    expect(recoveryLinkFailure({ name: 'AuthImplicitGrantRedirectError' })).toBe('invalid');
  });
});

describe('leaving a link that could not be used', () => {
  // Whether this device is still signed in is not known until the stored
  // session has been restored (for a returning player, a network refresh).
  it('offers no way on until the session is known, then the right one', () => {
    expect(linkErrorWayOn({ restoring: true, signedIn: false })).toBe('wait');
    // A session can be reported before the restore has finished with it.
    expect(linkErrorWayOn({ restoring: true, signedIn: true })).toBe('wait');
    expect(linkErrorWayOn({ restoring: false, signedIn: true })).toBe('game');
    expect(linkErrorWayOn({ restoring: false, signedIn: false })).toBe('sign-in');
  });

  // "Send a new link" opens the sign-in screen on the reset form; a player
  // who is signed in never sees that screen, so the request must not wait
  // for their next sign-out.
  it('opens the sign-in screen on the reset form only for a player signed out', () => {
    expect(signInIntent('forgot', false)).toBe('forgot');
    expect(signInIntent('forgot', true)).toBeNull();
    expect(signInIntent(null, false)).toBeNull();
    expect(signInIntent(undefined, false)).toBeNull();
  });
});
