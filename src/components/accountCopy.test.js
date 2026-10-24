import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// The account flow's headings, read from the files that draw them. One flow
// changed case half-way through: "Reset your password" and "Check your email"
// on the form that sends the link, then "Set a New Password", "Password
// Changed" and "This Link Has Expired" on the panel the link opens.
const read = (file) => readFileSync(resolve(__dirname, file), 'utf8');

const recoveryTitles = [...read('./PasswordRecovery.jsx').matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
// The h2s the sign-in card draws (the reset form, "Check your email").
const cardHeadings = ['./ForgotPassword.jsx', './AuthField.jsx'].flatMap((file) =>
  [...read(file).matchAll(/<h2\b[^>]*>\s*([^<{]+?)\s*<\/h2>/g)].map((m) => m[1]));

// Sentence case: a capital to start, and none after it but "I".
const sentenceCase = (title) => {
  const [first, ...rest] = title.split(/\s+/);
  return /^\p{Lu}/u.test(first) && rest.every((word) => word === 'I' || !/^\p{Lu}/u.test(word));
};

describe('account headings', () => {
  it('finds the headings to check', () => {
    expect(recoveryTitles.length).toBeGreaterThanOrEqual(6);
    expect(cardHeadings).toEqual(expect.arrayContaining(['Reset your password', 'Check your email']));
  });

  it.each([...recoveryTitles, ...cardHeadings])('"%s" is in sentence case', (title) => {
    expect(sentenceCase(title)).toBe(true);
  });

  it('can tell title case from sentence case', () => {
    expect(sentenceCase('Set a New Password')).toBe(false);
    expect(sentenceCase('This link can’t be used')).toBe(true);
  });
});
