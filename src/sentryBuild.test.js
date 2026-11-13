// @vitest-environment node
// vite.config.js pulls esbuild, which refuses jsdom's TextEncoder.
import { describe, it, expect } from 'vitest';
import { sentryBuildEnv } from '../vite.config.js';

describe('the Sentry release and environment baked into the build', () => {
  it('uses the Vercel commit and environment', () => {
    const d = sentryBuildEnv({ VERCEL_GIT_COMMIT_SHA: 'abc123', VERCEL_ENV: 'production' });
    expect(d['import.meta.env.VITE_SENTRY_RELEASE']).toBe('"terrible-teddies@abc123"');
    expect(d['import.meta.env.VITE_SENTRY_ENVIRONMENT']).toBe('"production"');
    expect(d.__SENTRY_DEBUG__).toBe('false');
  });
  it('lets an explicit value win, and is empty off Vercel', () => {
    expect(sentryBuildEnv({ VITE_SENTRY_RELEASE: 'r1', VERCEL_GIT_COMMIT_SHA: 'x' })['import.meta.env.VITE_SENTRY_RELEASE']).toBe('"r1"');
    expect(sentryBuildEnv({})['import.meta.env.VITE_SENTRY_RELEASE']).toBe('""');
  });
});
