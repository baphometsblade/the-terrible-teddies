import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../supabase.js';
import {
  LINK_SPEC, fetchDiscordGuildIds, linkPlatform, loadAuthProviders, unlinkPlatform,
} from './links.js';

vi.mock('../supabase.js', () => ({
  supabase: { rpc: vi.fn(), auth: {} },
  supabaseUrl: 'https://testproject.supabase.co',
  supabaseAnonKey: 'anon-key',
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabase.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('account linking', () => {
  it('asks Discord for identify and guilds, and X for nothing about followers', () => {
    expect(LINK_SPEC.discord).toEqual({ provider: 'discord', scopes: 'identify guilds' });
    expect(LINK_SPEC.x.provider).toBe('twitter');
    expect(LINK_SPEC.x.scopes).not.toMatch(/follows/);
  });

  it('hides both buttons when the settings call fails', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('offline')));
    expect(await loadAuthProviders(fetchImpl)).toEqual({ discord: false, x: false });
  });

  it('shows a provider only when auth settings say it is on', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ external: { discord: true, twitter: false } }),
    }));
    expect(await loadAuthProviders(fetchImpl)).toEqual({ discord: true, x: false });
    expect(fetchImpl.mock.calls[0][0]).toContain('/auth/v1/settings');
  });

  it('keeps guild names off the list it sends to the server', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { id: '12345678901234567', name: 'Filthy Secrets' },
      ]),
    }));
    const ids = await fetchDiscordGuildIds('token', fetchImpl);
    expect(ids).toEqual(['12345678901234567']);
    expect(JSON.stringify(ids)).not.toMatch(/Filthy/);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });

  it('links without navigating until GoTrue returns a URL', async () => {
    const assign = vi.fn();
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    const auth = {
      linkIdentity: vi.fn(() => Promise.resolve({ data: { url: 'https://discord.com/oauth2/authorize' }, error: null })),
    };
    const result = await linkPlatform('discord', { auth, assign, storage });
    expect(result.ok).toBe(true);
    expect(auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'discord',
      options: expect.objectContaining({
        scopes: 'identify guilds',
        skipBrowserRedirect: true,
      }),
    });
    expect(assign).toHaveBeenCalledWith('https://discord.com/oauth2/authorize');
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('does not start OAuth when this account already has that login', async () => {
    const assign = vi.fn();
    const auth = {
      getUserIdentities: vi.fn(() => Promise.resolve({
        data: { identities: [{ provider: 'discord', identity_id: 'abc' }] },
        error: null,
      })),
      linkIdentity: vi.fn(),
    };
    const result = await linkPlatform('discord', { auth, assign, storage: { setItem() {}, removeItem() {} } });
    expect(result).toEqual({ ok: true, reason: 'linked' });
    expect(auth.linkIdentity).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('sync_links');
  });

  it('refuses a login that already sits on another account', async () => {
    const assign = vi.fn();
    const auth = {
      getUserIdentities: vi.fn(() => Promise.resolve({ data: { identities: [] }, error: null })),
      linkIdentity: vi.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Identity is already linked to another user', code: 'identity_already_exists' },
      })),
    };
    const result = await linkPlatform('x', { auth, assign, storage: { setItem() {}, removeItem() {} } });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('taken');
    expect(result.message).toMatch(/someone else/);
    expect(assign).not.toHaveBeenCalled();
  });

  it('treats an already-linked error for this account as done', async () => {
    const auth = {
      getUserIdentities: vi.fn(() => Promise.resolve({ data: { identities: [] }, error: null })),
      linkIdentity: vi.fn(() => Promise.resolve({
        data: null,
        error: { message: 'Identity is already linked' },
      })),
    };
    const result = await linkPlatform('discord', { auth, assign: vi.fn(), storage: { setItem() {}, removeItem() {} } });
    expect(result).toEqual({ ok: true, reason: 'linked' });
    expect(supabase.rpc).toHaveBeenCalledWith('sync_links');
  });

  it('says so when manual linking is off, and does not navigate', async () => {
    const assign = vi.fn();
    const auth = {
      linkIdentity: vi.fn(() => Promise.resolve({
        data: { url: null },
        error: { message: 'Manual linking is disabled' },
      })),
    };
    const result = await linkPlatform('x', { auth, assign, storage: { setItem() {}, removeItem() {} } });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not switched on/);
    expect(assign).not.toHaveBeenCalled();
  });

  it('unlinks and then deletes the derived rows', async () => {
    const auth = {
      getUserIdentities: vi.fn(() => Promise.resolve({
        data: { identities: [{ provider: 'discord', identity_id: 'abc' }] },
        error: null,
      })),
      unlinkIdentity: vi.fn(() => Promise.resolve({ error: null })),
    };
    const result = await unlinkPlatform('discord', { auth });
    expect(result.ok).toBe(true);
    expect(auth.unlinkIdentity).toHaveBeenCalledWith({ provider: 'discord', identity_id: 'abc' });
    expect(supabase.rpc).toHaveBeenCalledWith('sync_links');
  });

  it('will not drop the last way in', async () => {
    const auth = {
      getUserIdentities: vi.fn(() => Promise.resolve({
        data: { identities: [{ provider: 'twitter', identity_id: 'abc' }] },
        error: null,
      })),
      unlinkIdentity: vi.fn(() => Promise.resolve({ error: { message: 'User must have at least 2 identities' } })),
    };
    const result = await unlinkPlatform('x', { auth });
    expect(result.reason).toBe('last');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
