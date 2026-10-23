// Where a buyer can ask about a payment. The purchase screen used to say
// "contact support" with no address anywhere in the app, which sent a buyer
// whose gems had not arrived nowhere at all. The address is the owner's to
// give (VITE_SUPPORT_EMAIL, documented in DEPLOYMENT.md); without it the
// screen shows the payment's reference for the buyer to keep instead, and
// never a contact that leads nowhere.

// A bare address only, so the mailto it builds opens a usable draft. Anything
// else (a typo, a display name, a stray quote) is treated as unset rather
// than shipped as a broken link.
const ADDRESS = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:.]+$/;

export const parseSupportEmail = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return ADDRESS.test(trimmed) ? trimmed : null;
};

export const SUPPORT_EMAIL = parseSupportEmail(import.meta.env.VITE_SUPPORT_EMAIL);

/**
 * A mailto for a question about one payment, its reference already in the
 * subject and body so support can find it. Null without an address.
 */
export function supportMailto(reference, subject, email = SUPPORT_EMAIL) {
  if (!email) return null;
  const line = `${subject} (order ${reference})`;
  const body = `Order reference: ${reference}\n\nWhat happened:\n`;
  return `mailto:${email}?subject=${encodeURIComponent(line)}&body=${encodeURIComponent(body)}`;
}
