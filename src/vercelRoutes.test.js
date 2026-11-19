// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { legalKind } from './lib/legalRoutes.js';
import { isAdminPath } from './lib/publicPaths.js';

// Vercel used to rewrite every address ("/(.*)") to index.html. A typo, a
// /.well-known probe, a card picture that is not there and, worst, an old
// hashed chunk asked for by a tab opened before a deploy all came back
// "200 text/html", and /assets/* carries a one-year immutable Cache-Control,
// so the edge and the browser kept that HTML under a .js address. Only the
// addresses the app actually reads now reach index.html. Everything else
// gets Vercel's real 404 with public/404.html.
const ROOT = process.cwd();
const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
const toIndex = vercel.rewrites.filter((r) => r.destination === '/index.html').map((r) => r.source);

// Vercel's sources here are plain paths; anything with a pattern in it
// would be a catch-all in disguise.
const reachesIndex = (path) => path === '/' || toIndex.includes(path);

describe('which addresses are the game', () => {
  it('has no catch-all rewrite to index.html', () => {
    expect(toIndex.length).toBeGreaterThan(0);
    for (const source of toIndex) {
      expect(source, `${source} is a pattern, not a page`).toMatch(/^\/[a-z-]+\/?$/);
    }
    expect(vercel.rewrites.some((r) => /\(\.\*\)|:path\*|\/\*$/.test(r.source) && r.destination === '/index.html')).toBe(false);
  });

  it('sends every page the client routes on to index.html, with or without a trailing slash', () => {
    for (const path of ['/terms', '/terms/', '/privacy', '/privacy/', '/admin', '/admin/']) {
      expect(legalKind(path) || isAdminPath(path), `${path} is not a client page`).toBeTruthy();
      expect(reachesIndex(path), `${path} would 404`).toBe(true);
    }
    // Every rewrite target is one the client actually renders.
    for (const source of toIndex) expect(legalKind(source) || isAdminPath(source)).toBeTruthy();
  });

  it('keeps the share-link API routes', () => {
    expect(vercel.rewrites).toContainEqual({ source: '/duel/:code', destination: '/api/duel?code=:code' });
    expect(vercel.rewrites).toContainEqual({ source: '/slip/:id', destination: '/api/slip?id=:id' });
  });

  it('lets build assets, card art and unknown addresses fall through to a 404', () => {
    for (const path of ['/assets/index-OLD123.js', '/cards/nope.webp', '/.well-known/security.txt', '/shop', '/this-page-does-not-exist']) {
      expect(reachesIndex(path), path).toBe(false);
    }
  });

  it('only lands players on addresses that are still served', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/manifest.json'), 'utf8'));
    const urls = [manifest.start_url, ...(manifest.shortcuts || []).map((s) => s.url)];
    for (const url of urls) expect(reachesIndex(new URL(url, 'https://x.example').pathname), url).toBe(true);
  });
});

describe('the 404 page', () => {
  const path = resolve(ROOT, 'public/404.html');
  const html = existsSync(path) ? readFileSync(path, 'utf8') : '';

  it('exists, is not indexed, and leads back to the game', () => {
    expect(html).not.toBe('');
    expect(html).toMatch(/<meta name="robots" content="noindex">/);
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toMatch(/<h1>[^<]+<\/h1>/);
    expect(html).toContain('href="/"');
  });

  it('carries no script, which the CSP would block, and nothing from the adult catalogue', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\/cards\//);
  });
});

describe('security headers', () => {
  const header = (key) => vercel.headers.find((h) => h.source === '/(.*)')?.headers
    .find((x) => x.key.toLowerCase() === key.toLowerCase())?.value;

  it('isolates the browsing context from cross-origin openers', () => {
    expect(header('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  it('keeps the existing hardening', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{8}/);
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Content-Security-Policy')).toMatch(/frame-ancestors 'none'/);
  });
});
