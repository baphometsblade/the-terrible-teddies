import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { legalKind } from './legalRoutes';
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
