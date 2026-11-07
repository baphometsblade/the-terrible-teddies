import { normalizePaymentProvider, paymentProvider, checkoutFunctionName } from './paymentProvider';

describe('VITE_PAYMENT_PROVIDER', () => {
  it('defaults to none, and only accepts ccbill or stripe', () => {
    expect(normalizePaymentProvider(undefined)).toBe('none');
    expect(normalizePaymentProvider('')).toBe('none');
    expect(normalizePaymentProvider('stripe-live')).toBe('none');
    expect(normalizePaymentProvider('CCBill')).toBe('ccbill');
    expect(normalizePaymentProvider(' stripe ')).toBe('stripe');
    expect(normalizePaymentProvider('none')).toBe('none');
  });

  it('reads the Vite env at call time', () => {
    vi.stubEnv('VITE_PAYMENT_PROVIDER', 'ccbill');
    expect(paymentProvider()).toBe('ccbill');
    vi.stubEnv('VITE_PAYMENT_PROVIDER', '');
    expect(paymentProvider()).toBe('none');
  });

  it('points each open provider at its edge function and none at nothing', () => {
    expect(checkoutFunctionName('ccbill')).toBe('ccbill-checkout');
    expect(checkoutFunctionName('stripe')).toBe('create-checkout-session');
    expect(checkoutFunctionName('none')).toBeNull();
    expect(checkoutFunctionName('paypal')).toBeNull();
  });
});
