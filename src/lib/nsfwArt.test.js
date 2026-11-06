import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  artIsSfw, heatClause, nsfwTeddyPrompt, generateNsfwTeddyImage, NSFW_NEGATIVE,
} from './nsfwArt';

describe('nsfw art heat', () => {
  it('adds nothing unless ART_HEAT is naughty or nasty', () => {
    expect(heatClause({})).toBe('');
    expect(heatClause({ ART_HEAT: 'lukewarm' })).toBe('');
    expect(heatClause({ ART_HEAT: 'naughty' })).toMatch(/seductive pose/);
    expect(heatClause({ ART_HEAT: 'nasty' })).toMatch(/torn fabric/);
  });

  it('lets ART_SFW strip the heat, same as the default register marker', () => {
    expect(artIsSfw({ ART_SFW: '1' })).toBe(true);
    expect(heatClause({ ART_SFW: '1', ART_HEAT: 'nasty' })).toBe('');
    expect(heatClause({ ART_SFW: 'yes', ART_HEAT: 'naughty' })).toBe('');
    expect(heatClause({ ART_SFW: '0', ART_HEAT: 'naughty' })).toMatch(/flirty/);
  });

  it('builds the old naughty and nasty prompts, and a plain one when SFW', () => {
    const naughty = nsfwTeddyPrompt('Pillow Biter', 'naughty', {});
    expect(naughty).toContain('seductive pose, playful, flirty expression');
    expect(naughty).toContain('Pillow Biter');
    const nasty = nsfwTeddyPrompt({ name: 'Debaucherous Duke' }, 'nasty', {});
    expect(nasty).toContain('torn fabric, spiky accessories');
    expect(nasty).toContain('Debaucherous Duke');
    const sfw = nsfwTeddyPrompt('Butler Bear', 'nasty', { ART_SFW: '1' });
    expect(sfw).not.toMatch(/seductive|torn fabric/);
    expect(sfw).toContain('Butler Bear');
    expect(NSFW_NEGATIVE).toMatch(/watermark/);
  });

  it('returns null without an endpoint, and the image when the endpoint answers', async () => {
    expect(await generateNsfwTeddyImage({ name: 'Duke' }, 'naughty', { env: {} })).toBeNull();
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [{ base64: 'abc123image' }],
    }));
    const image = await generateNsfwTeddyImage(
      { visual: 'a duke with wine' },
      'naughty',
      { env: { FOOOCUS_URL: 'http://127.0.0.1:8888/', FOOOCUS_AUTH: 'Bearer secret' }, fetch },
    );
    expect(image).toBe('abc123image');
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8888/v1/generation/text-to-image');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer secret');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.prompt).toContain('a duke with wine');
    expect(body.negative_prompt).toBe(NSFW_NEGATIVE);
  });

  it('returns null when the endpoint fails or throws', async () => {
    const bad = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    expect(await generateNsfwTeddyImage('x', 'nasty', { endpoint: 'http://sd', fetch: bad })).toBeNull();
    const boom = vi.fn(async () => { throw new Error('down'); });
    expect(await generateNsfwTeddyImage('x', 'naughty', { endpoint: 'http://sd', fetch: boom })).toBeNull();
  });

  it('is what the art generator appends, and only after the scene', () => {
    const src = readFileSync(resolve(process.cwd(), 'scripts/generate-card-art.mjs'), 'utf8');
    expect(src).toContain('heatClause');
    expect(src).toContain('${scene}${tail}');
  });
});
