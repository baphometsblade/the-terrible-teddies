// The HTML a shared challenge link returns to a scraper, and to a person who
// has not opened the game. Safe for work on purpose: a name, a tier, the
// public picture. The deck, the jokes and the age gate all live in the app.
// No script. The page is a document with a link.

import { OG_IMAGE, OG_IMAGE_ALT } from '../siteMeta.js';
import { PUBLIC_ORIGIN } from './ladder.js';

const ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a string into HTML text or an attribute. */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE[ch]);

/**
 * @param {{ code?: string, name?: string|null, tier?: string|null }} page
 * @returns {string}
 */
export function renderDuelPage({ code = '', name = null, tier = null } = {}) {
  const safeCode = /^[0-9a-f]{10}$/i.test(code) ? code.toLowerCase() : '';
  const who = name ? String(name) : 'Someone';
  const rung = tier ? String(tier) : '';
  const title = 'A deck was left out';
  const description = rung
    ? `${who} left a deck on the bar. ${rung}. Your move.`
    : `${who} left a deck on the bar. Your move.`;
  // Preview tags always name the public site, not whatever host rendered them.
  const image = `${PUBLIC_ORIGIN}${OG_IMAGE.path}`;
  const play = safeCode ? `/?duel=${safeCode}` : '/';
  const canonical = safeCode ? `${PUBLIC_ORIGIN}/duel/${safeCode}` : PUBLIC_ORIGIN;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE_ALT)}">
${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #100e0c; color: #f5f0e6; font-family: Georgia, "Times New Roman", serif; }
  main { max-width: 28rem; padding: 2rem 1.25rem; text-align: center; }
  p { color: #d9cfe3; line-height: 1.5; }
  a { display: inline-block; margin-top: 1.5rem; min-height: 44px; min-width: 44px; line-height: 44px; padding: 0 1.25rem; border-radius: 0.75rem; background: #fbbf24; color: #1a1208; font-weight: 700; text-decoration: none; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p>${escapeHtml(description)}</p>
  <p>18+. The filth stays inside, where it belongs.</p>
  <a href="${escapeHtml(play)}">Your move</a>
</main>
</body>
</html>
`;
}
