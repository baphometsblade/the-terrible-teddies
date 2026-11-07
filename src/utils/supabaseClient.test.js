import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  supabase, getPlayerSave, putPlayerSave, NO_SESSION,
  ensurePlayerProfile, setPlayerUsername, syncBattleResult, syncPlayerLevel,
} from './supabaseClient';

// With no usable session (an expired token whose refresh is failing, which
// auth-js holds for a minute), supabase-js sends the anon key as the bearer.
// The cloud-save functions refuse anon, and that refusal turned the cloud
// save off for the session. The calls now go with the user's own token, or
// not at all.

// What supabase.rpc() hands back: a builder whose headers and signal the
// test can read, resolving like the real one.
const fakeRpc = () => {
  const sent = { headers: {}, signal: null };
  const builder = {
    setHeader(name, value) { sent.headers[name] = value; return builder; },
    abortSignal(signal) { sent.signal = signal; return Promise.resolve({ data: { rev: 0, save: null }, error: null, status: 200 }); },
  };
  return { sent, builder };
};

afterEach(() => vi.restoreAllMocks());

describe('the cloud-save calls', () => {
  it('send nothing without a session, and answer as a failure to retry', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null });
    const rpc = vi.spyOn(supabase, 'rpc');
    expect(await getPlayerSave()).toEqual(NO_SESSION);
    expect(await putPlayerSave({ coins: 1 }, 3)).toEqual(NO_SESSION);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("send the session's own token, never the anon key", async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: { access_token: 'user-jwt' } }, error: null });
    const { sent, builder } = fakeRpc();
    const rpc = vi.spyOn(supabase, 'rpc').mockReturnValue(builder);
    const res = await putPlayerSave({ coins: 1 }, 3);
    expect(rpc).toHaveBeenCalledWith('put_player_save', { p_save: { coins: 1 }, p_base_rev: 3 });
    expect(sent.headers.Authorization).toBe('Bearer user-jwt');
    expect(sent.signal).toBeInstanceOf(AbortSignal);
    expect(res).toEqual({ data: { rev: 0, save: null }, error: null, status: 200 });
  });
});

describe('profile and battle sync', () => {
  it('do not call without a session', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({ data: { user: null }, error: null });
    const rpc = vi.spyOn(supabase, 'rpc');
    expect(await ensurePlayerProfile('Ada')).toBeNull();
    expect(await setPlayerUsername('Ada')).toBeNull();
    expect(await syncBattleResult(true, 1, 2, 3)).toBeNull();
    expect(await syncPlayerLevel(2, 40)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('send the payload and never a user id', async () => {
    const rpc = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: 'Ada', error: null });
    expect(await ensurePlayerProfile('Ada', 'user-1')).toBe(true);
    expect(await setPlayerUsername('Ada', 'user-1')).toBe('Ada');
    expect(await syncBattleResult(false, 4, 2, 9, 'user-1')).toBe(true);
    expect(await syncPlayerLevel(3, 40, 'user-1')).toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, 'upsert_player_profile', { p_username: 'Ada' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'set_player_username', { p_username: 'Ada' });
    expect(rpc).toHaveBeenNthCalledWith(3, 'sync_battle_result', {
      p_won: false,
      p_damage_dealt: 4,
      p_healing_done: 2,
      p_coins_earned: 9,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, 'sync_player_level', { p_level: 3, p_xp: 40 });
    for (const [, args] of rpc.mock.calls) expect(args).not.toHaveProperty('p_user_id');
  });
});
