import { describe, expect, it, vi } from 'vitest';
import { victorySpec, drawVictoryCard, shareCard, copyText, CARD_W, CARD_H } from './victoryCard';
import { TIER_ASIDES } from './ladder';

const EXPLICIT = /\b(fuck|shit|cock|dick|pussy|slut|whore|nude|naked|porn|nipple|orgasm|horny)\b/i;

describe('the share card stays safe for work', () => {
  it('draws a standing and a result without the in-game asides or explicit words', () => {
    const standing = victorySpec({ name: 'Ada', tier: 'Getting Handsy', rating: 1100 });
    const win = victorySpec({ name: 'Ada', won: true, tier: 'Getting Handsy', rating: 1112, rivalName: 'DreadBear' });
    const loss = victorySpec({ name: '<b>Ada</b>', won: false, rating: 988, rivalName: '"><script>' });
    for (const spec of [standing, win, loss]) {
      const text = Object.values(spec).join(' ');
      expect(text).not.toMatch(EXPLICIT);
      for (const aside of Object.values(TIER_ASIDES)) expect(text).not.toContain(aside);
    }
    expect(standing.title).toBe('On the ladder');
    expect(win.title).toBe('Still standing');
    expect(loss.title).toBe('Tapped out');
    expect(standing.footer).toMatch(/messy part stayed in/);
    expect(win.line).toBe('Against DreadBear');
    expect(loss.name).toBe('A player');
    expect(loss.line).toBe('Against a rival');
    expect(CARD_W).toBe(720);
    expect(CARD_H).toBe(960);
  });

  it('paints with fill and stroke, and a rect when the context has no roundRect', () => {
    const calls = [];
    const ctx = {
      beginPath() { calls.push('begin'); },
      rect() { calls.push('rect'); },
      fillRect() { calls.push('fillRect'); },
      strokeRect() { calls.push('strokeRect'); },
      fillText() { calls.push('fillText'); },
      fill() { calls.push('fill'); },
    };
    const spec = victorySpec({ name: 'Ada', tier: 'Barfly', rating: 1100 });
    expect(drawVictoryCard(ctx, spec)).toBe(true);
    expect(calls).toContain('fillRect');
    expect(calls).toContain('strokeRect');
    expect(calls).toContain('rect');
    expect(calls.filter((name) => name === 'fillText').length).toBeGreaterThan(3);
    expect(drawVictoryCard(null, spec)).toBe(false);
  });
});

describe('sharing falls back', () => {
  it('shares a file when the platform accepts one, and a download when it does not', async () => {
    const spec = victorySpec({ name: 'Ada', tier: 'Barfly', rating: 1100 });
    const blob = new Blob(['x'], { type: 'image/png' });
    const share = vi.fn(() => Promise.resolve());
    const canShare = vi.fn(() => true);
    expect(await shareCard(blob, spec, { share, canShare })).toBe('shared');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Terrible Teddies' }));

    const textOnly = { share: vi.fn(() => Promise.resolve()), canShare: vi.fn(() => false) };
    expect(await shareCard(blob, spec, textOnly)).toBe('shared-text');

    const cancelled = {
      share: vi.fn(() => Promise.reject(Object.assign(new Error('nope'), { name: 'AbortError' }))),
      canShare: vi.fn(() => false),
    };
    expect(await shareCard(blob, spec, cancelled)).toBe('dismissed');
    expect(await shareCard(blob, spec, {})).toBe('download');
  });

  it('copies through the clipboard and, if that throws, through a textarea', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('https://example.com/duel/abcdef1234')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.com/duel/abcdef1234');

    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    });
    document.execCommand = vi.fn(() => true);
    expect(await copyText('again')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
