import { afterEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../supabase.js';
import { challengeFriend, reportLadderResult, ticketFrom, reasonText, isMissingRpc, loadWeekly } from './client.js';

vi.mock('../supabase.js', () => ({ supabase: { rpc: vi.fn() } }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('ladder client', () => {
  it('retries a result the server says arrived too fast, and not a booked one', async () => {
    const wait = vi.fn(() => Promise.resolve());
    supabase.rpc
      .mockResolvedValueOnce({ data: { ok: false, reason: 'early' }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, won: true, delta: 12, rating: 1012 }, error: null });
    const receipt = await reportLadderResult('match-1', true, wait);
    expect(wait).toHaveBeenCalledWith(9000);
    expect(receipt.delta).toBe(12);
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'report_ladder_result', {
      p_match_id: 'match-1', p_won: true,
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('treats a missing function as the ladder being closed', async () => {
    expect(isMissingRpc({ code: 'PGRST202' })).toBe(true);
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' }, status: 404 });
    const board = await loadWeekly();
    expect(board.unavailable).toBe(true);
    expect(board.rows).toEqual([]);
  });

  it('reads a ticket and a reason', () => {
    expect(ticketFrom({
      ok: true, match_id: 'm', rival_name: 'Ada', label: 'Saved deck',
      deck: [1, 2], rival_rating: 1000, your_rating: 1000, kind: 'queue',
    }).deck).toEqual([1, 2]);
    expect(ticketFrom({ ok: false, reason: 'empty' })).toBeNull();
    expect(reasonText({ reason: 'capped' })).toMatch(/enough/);
    expect(reasonText({ reason: 'server', message: 'Deck must be 10 cards' })).toBe('Deck must be 10 cards');
  });

  it('deals a ghost challenge now and leaves a live one for PvP', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: {
        ok: true, mode: 'ghost', match_id: 'm', rival_name: 'Ada', label: 'Saved deck',
        deck: [1, 2], rival_rating: 1000, your_rating: 1000, kind: 'challenge',
        seam: 'ladder_matches',
      },
      error: null,
    });
    const ghost = await challengeFriend('friend-1', 'ghost');
    expect(supabase.rpc).toHaveBeenCalledWith('challenge_friend', { p_friend: 'friend-1', p_mode: 'ghost' });
    expect(ghost.ticket.deck).toEqual([1, 2]);

    supabase.rpc.mockResolvedValueOnce({
      data: { ok: true, mode: 'live', challenge_id: 'c', status: 'open', seam: 'friend_challenges' },
      error: null,
    });
    const live = await challengeFriend('friend-1', 'LIVE');
    expect(live.seam).toBe('friend_challenges');
    expect(live.ticket).toBeUndefined();
    expect(live.deck).toBeUndefined();
  });
});
