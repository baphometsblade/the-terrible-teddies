// CCBill FlexForms dynamic pricing.
//
// A single (non-recurring) bill's formDigest is the hex MD5 of
//   initialPrice + initialPeriod + currencyCode + salt
// concatenated with nothing between them. initialPrice always has two
// decimal places. CCBill's published example is DOCUMENTED_FORM_DIGEST.
//
// An approval post's response digest is MD5(subscriptionId + "1" + salt).
// A denial's is MD5(denialId + "0" + salt). The webhook checks those.

import { createHash, timingSafeEqual } from 'node:crypto';

export const CURRENCY_CODE_USD = '840';

// CCBill's minimum initial period is 2 days. A one-time gem purchase is not
// a subscription: the FlexForm is single-billing, and this period does not
// rebill. It is part of the digest, so it cannot be omitted.
export const ONE_TIME_INITIAL_PERIOD = '2';

export const FLEXFORMS_ORIGIN = 'https://api.ccbill.com/wap-frontflex/flexforms';

// CCBill support's worked example for a single-billing formDigest.
export const DOCUMENTED_FORM_DIGEST = Object.freeze({
  initialPrice: '10.00',
  initialPeriod: '30',
  currencyCode: '840',
  salt: 'qwertyasdfgzxcvbnhyujm',
  input: '10.0030840qwertyasdfgzxcvbnhyujm',
  digest: '931d2fa3cf0ed016780712901308bfad',
});

export function md5Hex(value) {
  return createHash('md5').update(String(value), 'utf8').digest('hex');
}

export function formDigestInput({ initialPrice, initialPeriod, currencyCode, salt }) {
  return `${initialPrice}${initialPeriod}${currencyCode}${salt}`;
}

export function formDigest(parts) {
  return md5Hex(formDigestInput(parts));
}

// Approval: subscription id, the digit 1, the salt. Denial: denial id, 0, salt.
export function approvalDigest(subscriptionId, salt) {
  return md5Hex(`${subscriptionId}1${salt}`);
}

export function denialDigest(denialId, salt) {
  return md5Hex(`${denialId}0${salt}`);
}

export function digestEqual(presented, expected) {
  if (typeof presented !== 'string' || typeof expected !== 'string') return false;
  const left = presented.trim().toLowerCase();
  const right = expected.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(left) || !/^[0-9a-f]{32}$/.test(right)) return false;
  const a = new Uint8Array(16);
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    a[i] = Number.parseInt(left.slice(i * 2, i * 2 + 2), 16);
    b[i] = Number.parseInt(right.slice(i * 2, i * 2 + 2), 16);
  }
  return timingSafeEqual(a, b);
}

// Integer cents, so 999 is "9.99" and never a binary float.
export function centsToInitialPrice(cents) {
  if (typeof cents !== 'number' || !Number.isInteger(cents) || cents < 0) return null;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

const SAFE_ID = /^[A-Za-z0-9-]+$/;

/**
 * The FlexForms URL for one dynamic one-time price. Null when the link would
 * be unsigned or point anywhere but CCBill's FlexForms host.
 */
export function flexFormPaymentLink({
  flexFormId,
  accountNumber,
  subaccount,
  priceCents,
  userId,
  bundleId,
  salt,
  initialPeriod = ONE_TIME_INITIAL_PERIOD,
  currencyCode = CURRENCY_CODE_USD,
}) {
  if (!SAFE_ID.test(flexFormId ?? '')) return null;
  if (!/^\d+$/.test(accountNumber ?? '') || !/^\d+$/.test(subaccount ?? '')) return null;
  if (typeof salt !== 'string' || salt.length === 0) return null;
  if (typeof userId !== 'string' || userId.length === 0) return null;
  if (typeof bundleId !== 'string' || bundleId.length === 0) return null;
  const initialPrice = centsToInitialPrice(priceCents);
  if (!initialPrice) return null;
  if (!/^\d+$/.test(String(initialPeriod)) || !/^\d{3}$/.test(String(currencyCode))) return null;

  const digest = formDigest({
    initialPrice,
    initialPeriod: String(initialPeriod),
    currencyCode: String(currencyCode),
    salt,
  });
  const url = new URL(`${FLEXFORMS_ORIGIN}/${flexFormId}`);
  url.searchParams.set('clientAccnum', accountNumber);
  url.searchParams.set('clientSubacc', subaccount);
  url.searchParams.set('initialPrice', initialPrice);
  url.searchParams.set('initialPeriod', String(initialPeriod));
  url.searchParams.set('currencyCode', String(currencyCode));
  url.searchParams.set('formDigest', digest);
  url.searchParams.set('userId', userId);
  url.searchParams.set('bundleId', bundleId);
  return {
    url: url.toString(),
    formDigest: digest,
    initialPrice,
    initialPeriod: String(initialPeriod),
    currencyCode: String(currencyCode),
  };
}
