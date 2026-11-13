// @vitest-environment node
// vite.config.js pulls esbuild, which refuses jsdom's TextEncoder.
import { describe, it, expect } from 'vitest';
import { preconnectSupabase, supabaseOrigin } from '../vite.config.js';

const run = (url) => {
  const plugin = preconnectSupabase();
  plugin.configResolved({ env: { VITE_SUPABASE_URL: url } });
  return plugin.transformIndexHtml();
};

describe('the Supabase preconnect hint', () => {
  it('hints the project origin, anonymous, in head', () => {
    expect(run('https://abcd.supabase.co/')).toEqual([
      { tag: 'link', injectTo: 'head', attrs: { rel: 'preconnect', href: 'https://abcd.supabase.co', crossorigin: '' } },
    ]);
  });

  it('drops any path, so the hint is the origin the requests pool on', () => {
    expect(supabaseOrigin('https://abcd.supabase.co/rest/v1')).toBe('https://abcd.supabase.co');
  });

  it('adds nothing without a usable https URL', () => {
    const saved = process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    try {
      expect(run(undefined)).toEqual([]);
      expect(run('not a url')).toEqual([]);
      expect(run('http://localhost:54321')).toEqual([]);
    } finally {
      if (saved !== undefined) process.env.VITE_SUPABASE_URL = saved;
    }
  });
});
