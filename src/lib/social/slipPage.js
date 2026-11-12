// The public fight slip. A scraper and a group chat get a wink: who, the
// rung, whether they were still standing, and the polite version of a taunt.
// No deck, no card names, no user id. Those stay behind the age gate.

import { OG_IMAGE, OG_IMAGE_ALT } from '../siteMeta.js';
import { PUBLIC_ORIGIN } from './ladder.js';
import { tauntPublic } from './taunts.js';
import { escapeHtml } from './duelPage.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {{ id?: string, name?: string|null, rival?: string|null, won?: boolean|null, tier?: string|null, taunt?: number|null }} slip
 */
export function renderSlipPage({ id = '', name = null, rival = null, won = null, tier = null, taunt = null, replay = null } = {}) {
  const safeId = UUID.test(id) ? id.toLowerCase() : '';
  const who = name ? String(name) : 'Someone';
  const other = rival ? String(rival) : 'a stranger';
  const rung = tier ? String(tier) : '';
  let headline = `${who} had a night out`;
  if (won === true) headline = `${who} was still standing`;
  else if (won === false) headline = `${who} tapped out`;
  const bits = [`Against ${other}.`];
  if (rung) bits.push(rung + '.');
  const wink = tauntPublic(taunt);
  if (wink) bits.push(wink);
  const description = bits.join(' ');
  const title = 'A Terrible Teddies slip';
  const image = `${PUBLIC_ORIGIN}${OG_IMAGE.path}`;
  const play = safeId ? `/?slip=${safeId}` : '/';
  const canonical = safeId ? `${PUBLIC_ORIGIN}/slip/${safeId}` : PUBLIC_ORIGIN;
  const watchCode = typeof replay === 'string' && /^[a-z0-9]{8,16}$/i.test(replay) ? replay : '';
  const watch = watchCode ? `${PUBLIC_ORIGIN}/?replay=${watchCode}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(headline)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE_ALT)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(headline)}">
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
  <h1>${escapeHtml(headline)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>18+. The filth stays inside, where it belongs.</p>
  <a href="${escapeHtml(play)}">Your move</a>
  ${watch ? `<a href="${escapeHtml(watch)}">Watch it back</a>` : ''}
</main>
</body>
</html>
`;
}
