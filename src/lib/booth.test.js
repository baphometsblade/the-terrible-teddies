import { describe, it, expect, vi } from 'vitest';
import { BOOTH, BOOTH_MAX, pickBooth } from './booth';
import { boothRemark, COMMENTATOR_PROMPT, OPPONENT_PERSONA, noteBooth } from './boothAi';

const BANNED = /no consent|forced entry|forced submission|no safe word|kids go to sleep|children's companion|bearly legal|guard cub/i;

describe('booth lines', () => {
  it('keeps every line short, unique, and clear of the floors', () => {
    for (const [heat, book] of Object.entries(BOOTH)) {
      for (const [pool, lines] of Object.entries(book)) {
        expect(lines.length, `${heat}.${pool}`).toBeGreaterThanOrEqual(8);
        expect(new Set(lines).size, `${heat}.${pool}`).toBe(lines.length);
        for (const line of lines) {
          expect(line.length, line).toBeLessThanOrEqual(BOOTH_MAX);
          expect(line.trim(), line).not.toBe('');
          expect(line, line).not.toMatch(BANNED);
        }
      }
    }
  });

  it('still carries lines from both old games', () => {
    const naughty = BOOTH.naughty.turn;
    expect(naughty).toContain('The teddies are eerily silent...');
    expect(naughty).toContain("That's a flirty little move!");
    expect(naughty).toContain('Was it good for you too?');
    expect(naughty).toContain("He's always ready for action. Always.");
    expect(BOOTH.nasty.turn).toContain('Danger is sexy!');
  });

  it('picks from the asked heat and does not repeat back to back', () => {
    for (let i = 0; i < 20; i++) {
      expect(BOOTH.nasty.turn).toContain(pickBooth('turn', null, 'nasty'));
    }
    let last = pickBooth('turn');
    for (let i = 0; i < 40; i++) {
      const next = pickBooth('turn', last, 'naughty');
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('falls back to naughty for an unknown heat', () => {
    expect(BOOTH.naughty.turn).toContain(pickBooth('turn', null, 'polite'));
  });
});

describe('boothRemark', () => {
  it('uses a canned line when no key is set and does not call fetch', async () => {
    const fetch = vi.fn();
    const line = await boothRemark('a hit landed', { fetch, apiKey: '' });
    expect(BOOTH.naughty.turn).toContain(line);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the model line when it fits', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '  "Right in the stitching."  ' }] } }] }),
    }));
    const line = await boothRemark('a face hit', { fetch, apiKey: 'test-key', heat: 'naughty' });
    expect(line).toBe('Right in the stitching.');
    expect(fetch).toHaveBeenCalledOnce();
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('gemini-2.5-flash');
    expect(url).toContain('key=test-key');
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.contents[0].parts[0].text).toContain('explicitly sexual with dark humor');
    expect(sent.contents[0].parts[0].text).toContain('utterly debauched');
  });

  it('falls back when the model is down, throws, or runs long', async () => {
    const down = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    expect(BOOTH.naughty.turn).toContain(await boothRemark('x', { fetch: down, apiKey: 'k' }));

    const boom = vi.fn(async () => { throw new Error('offline'); });
    expect(BOOTH.naughty.turn).toContain(await boothRemark('x', { fetch: boom, apiKey: 'k' }));

    const novel = 'x'.repeat(BOOTH_MAX + 5);
    const long = vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: novel }] } }] }),
    }));
    expect(BOOTH.naughty.turn).toContain(await boothRemark('x', { fetch: long, apiKey: 'k' }));
  });

  it('keeps the studio brief and the debauched persona on the module', () => {
    expect(COMMENTATOR_PROMPT).toMatch(/snarky, raunchy/);
    expect(OPPONENT_PERSONA).toMatch(/utterly debauched/);
  });
});

describe('noteBooth', () => {
  it('logs one canned line and does not wait on a key', () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_BOOTH_HEAT', '');
    const logged = [];
    const last = { current: null };
    noteBooth((line) => logged.push(line), last);
    expect(logged).toHaveLength(1);
    expect(logged[0].startsWith('Booth: "')).toBe(true);
    expect(last.current).toBe(logged[0].slice('Booth: "'.length, -1));
  });
});
