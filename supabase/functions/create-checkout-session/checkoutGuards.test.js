import { describe, it, expect } from 'vitest';
import { resolveOrigin, lookupBundle, redirectUrls } from './checkoutGuards.js';

const PROD = 'https://terribleteddies.example';
const ALLOWED = [PROD, 'http://localhost:5173'];

describe('origin allowlisting (open-redirect prevention)', () => {
  it('honours an origin that is on the list', () => {
    expect(resolveOrigin(PROD, ALLOWED)).toBe(PROD);
    expect(resolveOrigin('http://localhost:5173', ALLOWED)).toBe('http://localhost:5173');
  });

  // The whole point: success_url and cancel_url are built from this, so an
  // attacker origin winning here turns a completed Stripe checkout into a
  // redirect to their site.
  it('never returns an origin that is not on the list', () => {
    for (const hostile of [
      'https://evil.test',
      'https://terribleteddies.example.evil.test',   // suffix attack
      'https://terribleteddies.example@evil.test',   // userinfo attack
      'https://terribleteddies.example.',            // trailing dot
      'HTTPS://TERRIBLETEDDIES.EXAMPLE',             // case variance is NOT a match
      'null',
      '',
    ]) {
      expect(resolveOrigin(hostile, ALLOWED), hostile).toBe(PROD);
    }
  });

  it('falls back to the production origin when the header is absent', () => {
    expect(resolveOrigin(null, ALLOWED)).toBe(PROD);
    expect(resolveOrigin(undefined, ALLOWED)).toBe(PROD);
  });

  // The fallback must NOT be the value under test, or this cannot tell
  // "ignored the object" from "coerced it and matched" — both would return PROD.
  // With a different origin first in the list, only coercion returns PROD.
  it('ignores a non-string Origin rather than coercing it', () => {
    const FALLBACK_FIRST = ['https://fallback.example', PROD];
    expect(resolveOrigin({ toString: () => PROD }, FALLBACK_FIRST)).toBe('https://fallback.example');
    expect(resolveOrigin([PROD], FALLBACK_FIRST)).toBe('https://fallback.example');
    // ...and a genuine string still matches, so the guard is not just rejecting
    // everything.
    expect(resolveOrigin(PROD, FALLBACK_FIRST)).toBe(PROD);
  });

  // Returning null makes the caller refuse; returning '' would let it build
  // "/?purchase=success" and redirect relative to Stripe's own domain.
  it('returns null when nothing is configured, so the caller refuses', () => {
    expect(resolveOrigin(PROD, [])).toBeNull();
    expect(resolveOrigin(PROD, [undefined, null, ''])).toBeNull();
    expect(resolveOrigin(PROD, undefined)).toBeNull();
  });

  it('the first configured origin is the fallback — production, not localhost', () => {
    expect(resolveOrigin('https://evil.test', ALLOWED)).toBe(ALLOWED[0]);
  });
});

describe('bundle lookup', () => {
  const TABLE = {
    gems_small: { gems: 50, bonus: 0, price: 99 },
    gems_mega: { gems: 3000, bonus: 750, price: 4999 },
  };

  it('finds a real bundle', () => {
    expect(lookupBundle(TABLE, 'gems_mega')).toEqual({ gems: 3000, bonus: 750, price: 4999 });
  });

  it('rejects an unknown id', () => {
    expect(lookupBundle(TABLE, 'gems_free')).toBeNull();
  });

  // A bare table[id] hands these back as truthy functions, so they sail past an
  // `if (!bundle)` check and then price the session from undefined.
  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'does not resolve the prototype member %s to a bundle',
    (key) => {
      expect(lookupBundle(TABLE, key)).toBeNull();
    }
  );

  it('rejects non-string ids instead of coercing them', () => {
    for (const id of [null, undefined, 0, 1, {}, [], true]) {
      expect(lookupBundle(TABLE, id)).toBeNull();
    }
  });

  it('survives a missing table', () => {
    expect(lookupBundle(undefined, 'gems_small')).toBeNull();
    expect(lookupBundle(null, 'gems_small')).toBeNull();
  });
});

describe('redirect urls', () => {
  it('builds both urls from the safe origin and keeps Stripe\'s session placeholder', () => {
    const { success_url, cancel_url } = redirectUrls(PROD);
    expect(success_url).toBe(`${PROD}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`);
    expect(cancel_url).toBe(`${PROD}/?purchase=cancelled`);
    // PurchaseSuccess reads session_id from the query string; losing the
    // placeholder would strand every buyer on an unverifiable return.
    expect(success_url).toContain('{CHECKOUT_SESSION_ID}');
  });

  // redirectUrls itself guarantees nothing — it interpolates whatever it is
  // given. What ships is the COMPOSITION, which is what this pins: the only
  // origin that can reach a redirect URL is the one resolveOrigin approved.
  // Named for that rather than for a property the function does not have.
  it('composed with resolveOrigin, a rejected origin never reaches a redirect', () => {
    const { success_url, cancel_url } = redirectUrls(resolveOrigin('https://evil.test', ALLOWED));
    expect(success_url).toBe(`${PROD}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`);
    expect(cancel_url).toBe(`${PROD}/?purchase=cancelled`);
    expect(success_url).not.toContain('evil.test');
  });
});
