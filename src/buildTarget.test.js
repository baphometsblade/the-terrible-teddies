// @vitest-environment node
// vite.config.js pulls esbuild, which refuses jsdom's TextEncoder.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import config from '../vite.config.js';

// Playwright loads tsconfig.json and stops looking, so a tsconfig without the
// jsconfig path map makes every e2e file that imports `@/…` fail at collection
// (`Cannot find package '@/lib'`). allowJs is what lets that map apply to the
// .js sources the specs import.
describe('the configs the tools actually read', () => {
  const ts = JSON.parse(readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8'));
  const js = JSON.parse(readFileSync(new URL('../jsconfig.json', import.meta.url), 'utf8'));

  it('keeps the @ alias in tsconfig, which hides jsconfig from Playwright', () => {
    expect(ts.compilerOptions.allowJs).toBe(true);
    expect(ts.compilerOptions.paths['@/*']).toEqual(js.compilerOptions.paths['@/*']);
  });

  it('builds for Safari 15, not Vite’s Safari 16 baseline', () => {
    expect(config.build.target).toBe('safari15');
    expect(config.build.cssTarget).toBe('safari15');
  });
});
