// @vitest-environment node
// vite.config.js pulls esbuild, which refuses jsdom's TextEncoder.
import { describe, it, expect } from 'vitest';
import { preloadDisplayFont } from '../vite.config.js';

describe('the display font preload', () => {
  const plugin = preloadDisplayFont();
  const run = (bundle) => plugin.transformIndexHtml.handler('', { bundle });

  it('preloads each woff2 of the wordmark, and nothing else', () => {
    const tags = run({
      'assets/baloo-2-latin-800-normal-abc.woff2': { type: 'asset', fileName: 'assets/baloo-2-latin-800-normal-abc.woff2' },
      'assets/baloo-2-latin-600-normal-def.woff2': { type: 'asset', fileName: 'assets/baloo-2-latin-600-normal-def.woff2' },
      'assets/baloo-2-latin-800-normal-abc.woff': { type: 'asset', fileName: 'assets/baloo-2-latin-800-normal-abc.woff' },
      'assets/index-abc.js': { type: 'chunk', fileName: 'assets/index-abc.js' },
    });
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag).toMatchObject({
        tag: 'link',
        attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
      });
      expect(tag.attrs.href).toMatch(/^\/assets\/baloo-2-latin-(600|800)-normal-[\w-]+\.woff2$/);
    }
  });

  it('adds nothing in dev, where there is no bundle yet', () => {
    expect(run(undefined)).toBeUndefined();
  });
});