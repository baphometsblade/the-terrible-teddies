import { describe, expect, it } from 'vitest';
import { DEFAULT_PVP_REGION, functionUrl, pvpRegion, regionFailed } from './region.js';

const HOSTED = 'https://wqdrbywcktxgytkyqcco.supabase.co';

describe('pvpRegion', () => {
  it('pins hosted projects to the database region by default', () => {
    expect(pvpRegion(HOSTED)).toBe(DEFAULT_PVP_REGION);
    expect(pvpRegion(HOSTED, undefined)).toBe('ap-southeast-2');
  });
  it('honours a configured region, and "any" or empty turns pinning off', () => {
    expect(pvpRegion(HOSTED, 'us-east-1')).toBe('us-east-1');
    expect(pvpRegion(HOSTED, ' eu-west-2 ')).toBe('eu-west-2');
    expect(pvpRegion(HOSTED, 'any')).toBe('');
    expect(pvpRegion(HOSTED, '')).toBe('');
  });
  it('ignores junk rather than sending it to the gateway', () => {
    expect(pvpRegion(HOSTED, 'sydney')).toBe('');
    expect(pvpRegion(HOSTED, 'ap-southeast-2&x=1')).toBe('');
  });
  it('never pins a local stack or a bad URL', () => {
    expect(pvpRegion('http://127.0.0.1:54321')).toBe('');
    expect(pvpRegion('http://localhost:54321')).toBe('');
    expect(pvpRegion('not a url')).toBe('');
  });
});

describe('functionUrl', () => {
  it('adds forceFunctionRegion only when pinned', () => {
    expect(functionUrl(HOSTED, 'pvp-action', 'ap-southeast-2'))
      .toBe(`${HOSTED}/functions/v1/pvp-action?forceFunctionRegion=ap-southeast-2`);
    expect(functionUrl(HOSTED, 'pvp-action', '')).toBe(`${HOSTED}/functions/v1/pvp-action`);
    expect(functionUrl(`${HOSTED}/`, 'pvp-queue', '')).toBe(`${HOSTED}/functions/v1/pvp-queue`);
  });
});

describe('regionFailed', () => {
  it('retries unpinned only on gateway failures', () => {
    for (const status of [502, 503, 504, 546]) expect(regionFailed(status)).toBe(true);
    for (const status of [200, 400, 401, 409, 429, 500]) expect(regionFailed(status)).toBe(false);
  });
});
