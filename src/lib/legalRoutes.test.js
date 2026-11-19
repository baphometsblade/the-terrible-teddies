import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { legalKind, legalCanonical, pointCanonicalAt } from './legalRoutes';
import LegalPage from '@/components/LegalPage';

describe('legal routes', () => {
  it('names the two plain pages and nothing else', () => {
    expect(legalKind('/terms')).toBe('terms');
    expect(legalKind('/terms/')).toBe('terms');
    expect(legalKind('/privacy')).toBe('privacy');
    expect(legalKind('/privacy/')).toBe('privacy');
    expect(legalKind('/')).toBeNull();
    expect(legalKind('/shop')).toBeNull();
    expect(legalKind('')).toBeNull();
  });
});

describe('the rating label', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('declares the page adult, and SFW until a script says otherwise', () => {
    expect(html).toMatch(/<meta\s+name="rating"\s+content="adult"\s*\/?>/);
    expect(html).toMatch(/<html[^>]*data-content="sfw"/);
  });
});

describe('the legal pages', () => {
  const render = (kind) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(LegalPage, { kind })));
    return {
      host,
      unmount: () => { act(() => root.unmount()); host.remove(); },
    };
  };

  it('says the game is adults only, on both pages, and links them', () => {
    for (const kind of ['terms', 'privacy']) {
      const { host, unmount } = render(kind);
      expect(host.textContent).toMatch(/18 or older|18 and over/);
      expect(host.textContent).toMatch(/adults-only|Adults only/i);
      expect(host.querySelector('a[href="/terms"]')).not.toBeNull();
      expect(host.querySelector('a[href="/privacy"]')).not.toBeNull();
      expect(document.documentElement.dataset.content).toBe('sfw');
      unmount();
    }
  });

  it('does not render a card from the adult catalog', () => {
    const { host, unmount } = render('terms');
    expect(host.textContent).not.toMatch(/Nightcap Ned|Fluffy McFuckface|Glory-Hole/);
    expect(host.querySelector('img')).toBeNull();
    unmount();
  });
});

describe('the legal pages are their own canonical pages', () => {
  it('builds the address from the build canonical, keeping a base path', () => {
    expect(legalCanonical('terms', 'https://terribleteddies.vercel.app/')).toBe('https://terribleteddies.vercel.app/terms');
    expect(legalCanonical('privacy', 'https://example.com/game/')).toBe('https://example.com/game/privacy');
    expect(legalCanonical('privacy', 'https://example.com')).toBe('https://example.com/privacy');
    expect(legalCanonical('shop', 'https://example.com/')).toBeNull();
    expect(legalCanonical('terms', 'not a url')).toBeNull();
    expect(legalCanonical('terms', 'javascript:alert(1)')).toBeNull();
    expect(legalCanonical('terms', undefined)).toBeNull();
  });

  const seedHead = () => {
    document.head.innerHTML = '<link rel="canonical" href="https://terribleteddies.vercel.app/">'
      + '<meta property="og:url" content="https://terribleteddies.vercel.app/">';
    return {
      canonical: () => document.querySelector('link[rel="canonical"]').getAttribute('href'),
      og: () => document.querySelector('meta[property="og:url"]').getAttribute('content'),
    };
  };

  it('points the canonical link and og:url at the page, and puts them back', () => {
    const head = seedHead();
    const undo = pointCanonicalAt('https://terribleteddies.vercel.app/terms');
    expect(head.canonical()).toBe('https://terribleteddies.vercel.app/terms');
    expect(head.og()).toBe('https://terribleteddies.vercel.app/terms');
    undo();
    expect(head.canonical()).toBe('https://terribleteddies.vercel.app/');
    expect(head.og()).toBe('https://terribleteddies.vercel.app/');
  });

  it('does nothing without an address or the tags', () => {
    const head = seedHead();
    pointCanonicalAt(null)();
    expect(head.canonical()).toBe('https://terribleteddies.vercel.app/');
    document.head.innerHTML = '';
    expect(() => pointCanonicalAt('https://x.example/terms')()).not.toThrow();
  });

  it('is what LegalPage does while it is on screen', () => {
    for (const kind of ['terms', 'privacy']) {
      const head = seedHead();
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      act(() => root.render(createElement(LegalPage, { kind })));
      expect(head.canonical()).toBe(`https://terribleteddies.vercel.app/${kind}`);
      expect(head.og()).toBe(`https://terribleteddies.vercel.app/${kind}`);
      act(() => root.unmount());
      host.remove();
      expect(head.canonical()).toBe('https://terribleteddies.vercel.app/');
    }
  });
});
