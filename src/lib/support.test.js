import { describe, it, expect } from 'vitest';
import { parseSupportEmail, supportMailto } from './support';

describe('the support contact', () => {
  // The purchase screen said "contact support" with no contact anywhere. It
  // offers one only when the owner has configured an address.
  it('builds a mailto that carries the payment reference in subject and body', () => {
    const href = supportMailto('cs_test_a1B2', 'Gems not received', 'help@example.com');
    const url = new URL(href);
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('help@example.com');
    expect(url.searchParams.get('subject')).toBe('Gems not received (order cs_test_a1B2)');
    expect(url.searchParams.get('body')).toContain('Order reference: cs_test_a1B2');
  });

  it('offers no contact at all without an address', () => {
    expect(supportMailto('cs_test_a1B2', 'Gems not received', null)).toBeNull();
  });

  it('accepts only a bare address, so it never ships a broken link', () => {
    expect(parseSupportEmail('  help@example.com ')).toBe('help@example.com');
    for (const bad of [undefined, '', 'help', 'help@', '@example.com', 'Help <help@example.com>', 'a b@example.com', 'help@example', 'help@example.']) {
      expect(parseSupportEmail(bad), String(bad)).toBeNull();
    }
  });
});
