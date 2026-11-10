import { describe, expect, it } from 'vitest';
import { CRAWL_STOP_WAIT_MS, skipGemPrice } from './convenience';

describe('crawl skip price', () => {
  it('charges one gem per hour left, and the full walk is four', () => {
    expect(skipGemPrice(CRAWL_STOP_WAIT_MS)).toBe(4);
    expect(skipGemPrice(2 * 60 * 60 * 1000)).toBe(2);
    expect(skipGemPrice(30 * 60 * 1000)).toBe(1);
    expect(skipGemPrice(0)).toBe(0);
  });
});
