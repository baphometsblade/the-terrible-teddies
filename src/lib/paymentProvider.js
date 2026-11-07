// Which till the shop uses. Unset, blank, or anything else is closed:
// the gem shop shows an opening-soon state and never a button that
// cannot take payment. Stripe stays implemented and off.

export function normalizePaymentProvider(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'ccbill' || value === 'stripe') return value;
  return 'none';
}

export function paymentProvider() {
  return normalizePaymentProvider(import.meta.env.VITE_PAYMENT_PROVIDER);
}

export function checkoutFunctionName(provider = paymentProvider()) {
  if (provider === 'ccbill') return 'ccbill-checkout';
  if (provider === 'stripe') return 'create-checkout-session';
  return null;
}

export const PAYMENT_PROCESSOR_LABEL = Object.freeze({
  stripe: 'Stripe',
  ccbill: 'CCBill',
});
