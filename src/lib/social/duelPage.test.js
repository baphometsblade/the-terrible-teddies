import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { escapeHtml, renderDuelPage } from './duelPage';

const EXPLICIT = /\b(fuck|shit|cock|dick|pussy|slut|whore|nude|naked|porn|nipple|orgasm|horny)\b/i;

describe('challenge preview page', () => {
  it('escapes a name and never includes a script or a deck', () => {
    const html = renderDuelPage({
      code: 'abcdef1234',
      name: '<Ada> & "Bear"',
      tier: 'Barfly',
    });
    expect(html).toContain('&lt;Ada&gt; &amp; &quot;Bear&quot;');
    expect(html).not.toContain('<Ada>');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('https://terribleteddies.vercel.app/og-image.jpg');
    expect(html).toContain('https://terribleteddies.vercel.app/duel/abcdef1234');
    expect(html).toContain('href="/?duel=abcdef1234"');
    expect(html).toContain('Your move');
    expect(html).toContain('og:title');
    expect(html).not.toMatch(EXPLICIT);
    expect(html).not.toMatch(/deck ids|user_id/i);
  });

  it('stays generic when the code is not a code', () => {
    const html = renderDuelPage({ code: '<script>', name: null });
    expect(html).toContain('Someone left a deck on the bar. Your move.');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('<script>');
    expect(escapeHtml(`"'&<>`)).toBe('&quot;&#39;&amp;&lt;&gt;');
  });

  it('is rewritten ahead of the SPA catch-all', () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
    const duel = vercel.rewrites.findIndex((rule) => rule.source === '/duel/:code');
    const spa = vercel.rewrites.findIndex((rule) => rule.source === '/(.*)');
    expect(duel).toBeGreaterThanOrEqual(0);
    expect(duel).toBeLessThan(spa);
    expect(vercel.rewrites[duel].destination).toBe('/api/duel?code=:code');
  });
});
