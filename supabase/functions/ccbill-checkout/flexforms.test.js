// CCBill FlexForms dynamic pricing, from CCBill's own Dynamic Pricing note:
// for a single (non-recurring) bill the formDigest is the hex MD5 of
// initialPrice + initialPeriod + currencyCode + salt, concatenated with no
// spaces, and initialPrice always carries two decimal places.
//
// Their worked example:
//   initialPrice 10.00, initialPeriod 30, currencyCode 840,
//   salt qwertyasdfgzxcvbnhyujm
//   string 10.0030840qwertyasdfgzxcvbnhyujm
//   formDigest 931d2fa3cf0ed016780712901308bfad
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  DOCUMENTED_FORM_DIGEST, ONE_TIME_INITIAL_PERIOD, CURRENCY_CODE_USD,
  formDigestInput, formDigest, centsToInitialPrice, flexFormPaymentLink,
} from './flexforms.js';

const INDEX_TS = resolve(process.cwd(), 'supabase/functions/ccbill-checkout/index.ts');

describe('CCBill formDigest, documented example', () => {
  it('concatenates initialPrice, initialPeriod, currencyCode and salt with nothing between them', () => {
    expect(formDigestInput(DOCUMENTED_FORM_DIGEST)).toBe(DOCUMENTED_FORM_DIGEST.input);
    expect(DOCUMENTED_FORM_DIGEST.input).toBe('10.0030840qwertyasdfgzxcvbnhyujm');
  });

  it('matches the MD5 CCBill published for that string', () => {
    expect(formDigest(DOCUMENTED_FORM_DIGEST)).toBe('931d2fa3cf0ed016780712901308bfad');
    expect(formDigest(DOCUMENTED_FORM_DIGEST)).toBe(DOCUMENTED_FORM_DIGEST.digest);
  });

  it('changes when any input changes, including a trailing zero on the price', () => {
    const base = formDigest(DOCUMENTED_FORM_DIGEST);
    expect(formDigest({ ...DOCUMENTED_FORM_DIGEST, initialPrice: '10.01' })).not.toBe(base);
    expect(formDigest({ ...DOCUMENTED_FORM_DIGEST, initialPeriod: '2' })).not.toBe(base);
    expect(formDigest({ ...DOCUMENTED_FORM_DIGEST, currencyCode: '978' })).not.toBe(base);
    expect(formDigest({ ...DOCUMENTED_FORM_DIGEST, salt: 'other-salt' })).not.toBe(base);
    expect(formDigest({ ...DOCUMENTED_FORM_DIGEST, initialPrice: '10.0' })).not.toBe(base);
  });
});

describe('a one-time FlexForms link', () => {
  const args = {
    flexFormId: 'a1b2c3-d4',
    accountNumber: '900000',
    subaccount: '0000',
    priceCents: 999,
    userId: '11111111-1111-4111-8111-111111111111',
    bundleId: 'gems_large',
    salt: 'qwertyasdfgzxcvbnhyujm',
  };

  it('prices from integer cents with two decimals, never a float', () => {
    expect(centsToInitialPrice(99)).toBe('0.99');
    expect(centsToInitialPrice(499)).toBe('4.99');
    expect(centsToInitialPrice(1999)).toBe('19.99');
    expect(centsToInitialPrice(4999)).toBe('49.99');
    expect(centsToInitialPrice(0)).toBe('0.00');
    expect(centsToInitialPrice(9.99)).toBeNull();
    expect(centsToInitialPrice(-1)).toBeNull();
  });

  it('builds a dynamic one-time link: period 2, currency 840, and the documented digest', () => {
    const link = flexFormPaymentLink(args);
    const url = new URL(link.url);
    expect(url.origin + url.pathname).toBe('https://api.ccbill.com/wap-frontflex/flexforms/a1b2c3-d4');
    expect(url.searchParams.get('clientAccnum')).toBe('900000');
    expect(url.searchParams.get('clientSubacc')).toBe('0000');
    expect(url.searchParams.get('initialPrice')).toBe('9.99');
    expect(url.searchParams.get('initialPeriod')).toBe(ONE_TIME_INITIAL_PERIOD);
    expect(ONE_TIME_INITIAL_PERIOD).toBe('2');
    expect(url.searchParams.get('currencyCode')).toBe(CURRENCY_CODE_USD);
    expect(CURRENCY_CODE_USD).toBe('840');
    expect(url.searchParams.get('userId')).toBe(args.userId);
    expect(url.searchParams.get('bundleId')).toBe('gems_large');
    expect(url.searchParams.get('formDigest')).toBe(formDigest({
      initialPrice: '9.99',
      initialPeriod: '2',
      currencyCode: '840',
      salt: args.salt,
    }));
    expect(link.url).not.toContain(args.salt);
  });

  it('refuses to build a link when the secret or the ids are missing', () => {
    expect(flexFormPaymentLink({ ...args, salt: '' })).toBeNull();
    expect(flexFormPaymentLink({ ...args, salt: undefined })).toBeNull();
    expect(flexFormPaymentLink({ ...args, flexFormId: '' })).toBeNull();
    expect(flexFormPaymentLink({ ...args, flexFormId: '../evil' })).toBeNull();
    expect(flexFormPaymentLink({ ...args, accountNumber: '900000;drop' })).toBeNull();
    expect(flexFormPaymentLink({ ...args, subaccount: '' })).toBeNull();
    expect(flexFormPaymentLink({ ...args, userId: '' })).toBeNull();
    expect(flexFormPaymentLink({ ...args, bundleId: '' })).toBeNull();
    expect(flexFormPaymentLink({ ...args, priceCents: 9.99 })).toBeNull();
  });
});

describe('ccbill-checkout wires the same guards as the Stripe checkout', () => {
  const source = readFileSync(INDEX_TS, 'utf8');

  it('verifies the JWT, rate-limits on the buyer token, and looks the bundle up itself', () => {
    expect(source).toMatch(/auth\.getUser\(/);
    expect(source).toMatch(/rpc\("check_rate_limit",\s*\{\s*p_action_type:\s*"checkout",?\s*\}/);
    const lookup = source.indexOf('lookupBundle(');
    const link = source.indexOf('flexFormPaymentLink(');
    expect(lookup).toBeGreaterThan(-1);
    expect(lookup).toBeLessThan(link);
  });

  it('passes the user id and the bundle id, and records a checkout hold with the service role', () => {
    expect(source).toMatch(/userId:\s*user\.id/);
    expect(source).toMatch(/bundleId:\s*bundle_id/);
    const create = source.indexOf('flexFormPaymentLink(');
    const claim = source.indexOf('"claim_checkout_hold"');
    expect(source.indexOf('"get_checkout_hold"')).toBeGreaterThan(-1);
    expect(create).toBeLessThan(claim);
    expect(source).toMatch(/claimOutcome\(/);
    expect(source).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).toMatch(/onePerAccountRefusal\(/);
  });
});
