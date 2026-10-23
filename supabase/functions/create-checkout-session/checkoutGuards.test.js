import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import {
  resolveOrigin, lookupBundle, redirectUrls, onePerAccountRefusal, ONE_PER_ACCOUNT_BUNDLES,
  checkoutExpiry, ONE_PER_ACCOUNT_CHECKOUT_TTL_SECONDS, holdDecision, HOLD_ACTION,
  isMissingStripeSession, claimOutcome,
} from './checkoutGuards.js';

const PROD = 'https://terribleteddies.example';
const ALLOWED = [PROD, 'http://localhost:5173'];
// By repo path, like gemBundles.test.js: under jsdom import.meta.url is not a file URL.
const INDEX_TS = resolve(process.cwd(), 'supabase/functions/create-checkout-session/index.ts');

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

describe('one Starter Gem Pack per account', () => {
  // The Shop calls it a "NEW PLAYER BOOST"; the function used to sell it to
  // any account any number of times.
  it('refuses a second one once the first is completed', () => {
    expect(onePerAccountRefusal('starter_bundle', [{ status: 'completed' }])).toEqual({
      status: 409,
      error: expect.stringMatching(/one per account/),
      code: 'already_purchased',
    });
  });

  it('counts a disputed one, which a won dispute turns back into completed', () => {
    expect(onePerAccountRefusal('starter_bundle', [{ status: 'disputed' }])?.status).toBe(409);
  });

  it('allows it again after a refund, and for an account that never bought one', () => {
    expect(onePerAccountRefusal('starter_bundle', [{ status: 'refunded' }])).toBeNull();
    expect(onePerAccountRefusal('starter_bundle', [])).toBeNull();
    expect(onePerAccountRefusal('starter_bundle', null)).toBeNull();
  });

  it('never limits the ordinary gem bundles', () => {
    for (const id of ['gems_small', 'gems_mega', 'weekly_gem_pass']) {
      expect(onePerAccountRefusal(id, [{ status: 'completed' }]), id).toBeNull();
    }
  });

  it('names only bundles the function sells', () => {
    // A typo here would quietly limit nothing.
    const source = readFileSync(INDEX_TS, 'utf8');
    for (const id of ONE_PER_ACCOUNT_BUNDLES) expect(source).toMatch(new RegExp(`\\b${id}:\\s*\\{`));
  });

  it('is checked by the function before a Stripe session is created', () => {
    // There is no Deno in CI, so pin the wiring in the source: the refusal
    // must be consulted, and answered, ahead of stripe.checkout.sessions.create.
    const source = readFileSync(INDEX_TS, 'utf8');
    const refusal = source.indexOf('onePerAccountRefusal(');
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(source.indexOf('stripe.checkout.sessions.create'));
  });

  // fulfill_gem_purchase refuses a second one in SQL, from its own copy of
  // the list. Drift either way is silent: a bundle the SQL does not know is
  // credited twice, one the JS does not know is never offered a hold.
  it('names the same bundles as the SQL that refuses a second one', () => {
    const dir = resolve(process.cwd(), 'supabase/migrations');
    let list = null;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(resolve(dir, file), 'utf8');
      const def = sql.match(/FUNCTION\s+(?:public\.)?one_per_account_bundle\s*\([\s\S]*?ANY\s*\(\s*ARRAY\[([^\]]*)\]/i);
      if (def) list = [...def[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    }
    expect(list, 'no migration defines one_per_account_bundle').not.toBeNull();
    expect([...list].sort()).toEqual([...ONE_PER_ACCOUNT_BUNDLES].sort());
  });
});

// A buyer who opened two starter checkouts before paying either could pay
// both: the refusal above sees only fulfilled purchases. While an account has
// one open, the function hands that one back.
describe('one open starter checkout per account', () => {
  const HOLD = { stripe_session_id: 'cs_open', checkout_url: 'https://checkout.stripe.com/c/pay/cs_open' };

  it('creates one when the account has none open', () => {
    expect(holdDecision(null, null)).toEqual({ action: HOLD_ACTION.CREATE });
  });

  it('hands back the open one instead of creating a second', () => {
    const live = { id: 'cs_open', status: 'open', url: 'https://checkout.stripe.com/c/pay/cs_open#live' };
    expect(holdDecision(HOLD, live)).toEqual({ action: HOLD_ACTION.REUSE, url: live.url, sessionId: 'cs_open' });
    // Stripe's own url first; the recorded one if Stripe leaves it out.
    expect(holdDecision(HOLD, { id: 'cs_open', status: 'open', url: null }).url).toBe(HOLD.checkout_url);
  });

  it('sells nothing more once that checkout is paid, with the code that marks the offer claimed', () => {
    expect(holdDecision(HOLD, { id: 'cs_open', status: 'complete', url: null })).toEqual({
      action: HOLD_ACTION.REFUSE,
      status: 409,
      error: expect.stringMatching(/gone through/),
      code: 'already_purchased',
    });
  });

  it('replaces it once Stripe says it expired, or does not know it', () => {
    expect(holdDecision(HOLD, { id: 'cs_open', status: 'expired', url: null }))
      .toEqual({ action: HOLD_ACTION.REPLACE, replaces: 'cs_open' });
    expect(holdDecision(HOLD, null)).toEqual({ action: HOLD_ACTION.REPLACE, replaces: 'cs_open' });
  });

  it('tells "Stripe has no such session" from a failure worth refusing on', () => {
    expect(isMissingStripeSession({ code: 'resource_missing' })).toBe(true);
    expect(isMissingStripeSession({ raw: { code: 'resource_missing' } })).toBe(true);
    expect(isMissingStripeSession({ statusCode: 404 })).toBe(true);
    expect(isMissingStripeSession({ type: 'StripeConnectionError' })).toBe(false);
    expect(isMissingStripeSession(new Error('socket hang up'))).toBe(false);
    expect(isMissingStripeSession(undefined)).toBe(false);
  });

  // Two requests at once both find nothing open and both create a session;
  // the hold's primary key lets one record it. The loser sends its buyer to
  // the winner's page and expires its own, whose URL it never handed out.
  it('sends the loser of a race to the winner\'s checkout and expires its own', () => {
    const created = { id: 'cs_mine', url: 'https://checkout.stripe.com/c/pay/cs_mine' };
    expect(claimOutcome([{ stripe_session_id: 'cs_mine', checkout_url: created.url, claimed: true }], created))
      .toEqual({ url: created.url, sessionId: 'cs_mine', expireCreated: false });
    expect(claimOutcome([{ stripe_session_id: 'cs_open', checkout_url: HOLD.checkout_url, claimed: false }], created))
      .toEqual({ url: HOLD.checkout_url, sessionId: 'cs_open', expireCreated: true });
  });

  it('gives no answer, so the caller refuses, when the claim returns nothing usable', () => {
    const created = { id: 'cs_mine', url: 'https://checkout.stripe.com/c/pay/cs_mine' };
    for (const rows of [null, [], [{}], [{ claimed: false }], [{ claimed: 'yes' }]]) {
      expect(claimOutcome(rows, created), JSON.stringify(rows)).toBeNull();
    }
  });

  it('gives a starter checkout half an hour (Stripe\'s floor is 30 minutes) and leaves the rest at Stripe\'s default', () => {
    const now = 1_800_000_000.7;
    expect(checkoutExpiry('starter_bundle', now)).toBe(1_800_000_000 + ONE_PER_ACCOUNT_CHECKOUT_TTL_SECONDS);
    expect(ONE_PER_ACCOUNT_CHECKOUT_TTL_SECONDS).toBeGreaterThan(30 * 60);
    expect(ONE_PER_ACCOUNT_CHECKOUT_TTL_SECONDS).toBeLessThan(60 * 60);
    for (const id of ['gems_small', 'gems_mega', 'weekly_gem_pass']) expect(checkoutExpiry(id, now), id).toBeUndefined();
  });

  it('is wired into the function: look up before creating, record after, expire a loser', () => {
    const source = readFileSync(INDEX_TS, 'utf8');
    const lookup = source.indexOf('"get_checkout_hold"');
    const decide = source.indexOf('holdDecision(');
    const create = source.indexOf('stripe.checkout.sessions.create');
    const claim = source.indexOf('"claim_checkout_hold"');
    expect(lookup).toBeGreaterThan(-1);
    expect(lookup).toBeLessThan(decide);
    expect(decide).toBeLessThan(create);
    expect(create).toBeLessThan(claim);
    expect(source.slice(claim)).toMatch(/claimOutcome\(/);
    expect(source).toMatch(/expires_at:\s*expiresAt/);
    expect(source).toMatch(/checkoutExpiry\(bundle_id/);
    expect(source).toMatch(/stripe\.checkout\.sessions\.expire\(/);
    // Holds are written with the service role: no client role can touch them.
    expect(source).toMatch(/serviceClient\s*=\s*createClient\([\s\S]*?SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).toMatch(/serviceClient\.rpc\("get_checkout_hold"/);
    expect(source).toMatch(/serviceClient\.rpc\("claim_checkout_hold"/);
  });
});
