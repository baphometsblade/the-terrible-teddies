import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { registerShell, isInstalled, listenForInstall } from './pwa';

const read = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('the installable shell', () => {
  it('registers a worker only in a production build', () => {
    const calls = [];
    const nav = { serviceWorker: { register: (url) => { calls.push(url); return Promise.resolve(); } } };
    const target = { addEventListener: (_event, fn) => fn() };
    registerShell(nav, false, target);
    expect(calls).toEqual([]);
    registerShell(nav, true, target);
    expect(calls).toEqual(['/sw.js']);
  });

  it('treats a standalone display, and iOS standalone, as already installed', () => {
    expect(isInstalled({}, () => ({ matches: true }))).toBe(true);
    expect(isInstalled({ standalone: true }, () => ({ matches: false }))).toBe(true);
    expect(isInstalled({}, () => ({ matches: false }))).toBe(false);
    expect(isInstalled({}, () => { throw new Error('no'); })).toBe(false);
  });

  it('holds the browser prompt instead of letting it fire on its own', async () => {
    let handler;
    const target = {
      addEventListener: (_name, fn) => { handler = fn; },
      removeEventListener: () => { handler = null; },
    };
    let held = null;
    const stop = listenForInstall((offer) => { held = offer; }, target);
    const raw = {
      preventDefault() { raw.defaulted = true; },
      prompt() { raw.prompted = true; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };
    handler(raw);
    expect(raw.defaulted).toBe(true);
    expect(await held.prompt()).toBe('accepted');
    expect(raw.prompted).toBe(true);
    expect(await held.prompt()).toBe('unavailable');
    stop();
    expect(handler).toBeNull();
  });

  it('never caches a bundle: navigations are network-first and nothing else is touched', () => {
    const sw = read('public/sw.js');
    expect(sw).not.toMatch(/caches\b/);
    expect(sw).toContain("event.request.mode !== 'navigate'");
    expect(sw).toContain('fetch(event.request)');
    expect(sw).toContain('Could not reach the bar');
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    const html = read('index.html');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('apple-mobile-web-app-title');
  });
});
