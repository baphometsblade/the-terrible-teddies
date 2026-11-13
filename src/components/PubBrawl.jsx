import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { HOUSE_RULES } from '@/lib/houseRules';
import { mvpLine } from '@/lib/matchNight';
import {
  LIVE_POLL_MS, newActionId, pollDelay, pvpPost, watchViews,
} from '@/lib/pvp/client';
import { cardsFor, knownDeck } from '@/lib/pvp/decks';
import { isCardAvailable, refreshPackSeasons } from '@/lib/seasons';
import { toGhostId } from '@/lib/social/ghostDeck';
import { drawGhost, slipUrl, ticketFrom } from '@/lib/social/client';
import { openReplay, replayForMatch } from '@/lib/replay/client';
import { TAUNTS } from '@/lib/social/taunts';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { supabase } from '@/utils/supabaseClient';
import { useGameStore } from '@/stores/gameStore';

const btn = `inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-display font-bold ${FOCUS_OUTLINE}`;

function secondsLeft(deadline, now) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 1000));
}

const PubBrawl = forwardRef(function PubBrawl({ initialCode = '', onGhost, onLeave }, ref) {
  const playerName = useGameStore((s) => s.playerName);
  const ownedCards = useGameStore((s) => s.ownedCards);
  const currentDeck = useGameStore((s) => s.currentDeck);
  const savedDecks = useGameStore((s) => s.savedDecks);
  const recordLiveBrawl = useGameStore((s) => s.recordLiveBrawl);
  const decks = useMemo(() => {
    const rows = [{ name: 'The one you fight with', cards: currentDeck || [] }];
    for (const saved of savedDecks || []) rows.push(saved);
    return rows;
  }, [currentDeck, savedDecks]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [rule, setRule] = useState('standard');
  const [code, setCode] = useState(initialCode || '');
  const [invite, setInvite] = useState('');
  const [notice, setNotice] = useState('');
  const [queue, setQueue] = useState(null);
  const [view, setView] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [userId, setUserId] = useState('');
  const booked = useRef(false);
  const viewRef = useRef(null);
  const queueRef = useRef(null);
  const liveRef = useRef(false);
  const seenAtRef = useRef(0);
  const [attackerId, setAttackerId] = useState(null);
  viewRef.current = view;
  queueRef.current = queue;

  const deck = decks[deckIndex] || decks[0];
  const ownedIds = deck?.cards || [];
  const filedCards = cardsFor(ownedIds.map((id) => toGhostId(id)).filter((id) => id != null)) || [];
  const ownedSet = new Set((ownedCards || []).map(String));
  const unfieldable = filedCards.some((card) => (
    !isCardAvailable(card.id) || !(ownedSet.has(String(card.id)) || (card.filed != null && ownedSet.has(String(card.filed))))
  ));
  const deckError = knownDeck(ownedIds) || (unfieldable ? 'That deck has a card you cannot field.' : null);
  const deckIds = ownedIds.map((id) => toGhostId(id)).filter((id) => id != null);

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (live) setUserId(data.session?.user?.id || '');
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    refreshPackSeasons();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    const stop = watchViews(userId, (payload) => {
      if (!payload?.matchId) return;
      seenAtRef.current = Date.now();
      setView((prev) => (prev && prev.matchId !== payload.matchId ? prev : payload));
      setReveal(true);
    }, (live) => { liveRef.current = live; });
    return () => {
      liveRef.current = false;
      stop();
    };
  }, [userId]);

  const revealedId = view?.matchId || '';
  useEffect(() => {
    if (!reveal || !revealedId) return undefined;
    const timer = setTimeout(() => setReveal(false), 2000);
    return () => clearTimeout(timer);
  }, [reveal, revealedId]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const current = viewRef.current;
      const waiting = queueRef.current;
      if (current?.matchId && current.phase !== 'over') {
        if (liveRef.current && Date.now() - seenAtRef.current < LIVE_POLL_MS) return;
        seenAtRef.current = Date.now();
        const sync = await pvpPost('pvp-action', { op: 'sync', matchId: current.matchId });
        if (stop) return;
        if (sync?.view) {
          setOffline(false);
          setView(sync.view);
        } else if (sync?.error === 'unreachable') setOffline(true);
      } else if (waiting && !current) {
        const status = await pvpPost('pvp-queue', { op: 'status' });
        if (stop) return;
        setQueue(status);
        if (status?.view) {
          setView(status.view);
          setReveal(true);
        }
      }
    };
    // One look at a time, on the schedule pollDelay sets: the old bare
    // setInterval sent a queue call every 750 ms even while the last one was
    // still out, and kept asking from a hidden tab.
    let timer = null;
    let busy = false;
    const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const delay = () => {
      const current = viewRef.current;
      return pollDelay({
        inMatch: !!(current?.matchId && current.phase !== 'over'),
        queued: !!queueRef.current && !current,
        live: liveRef.current,
        hidden: hidden(),
      });
    };
    const schedule = (ms) => {
      clearTimeout(timer);
      timer = null;
      if (!stop && ms != null) timer = setTimeout(run, ms);
    };
    const run = async () => {
      if (stop || busy) return;
      if (hidden()) return; // visibilitychange picks it up again
      busy = true;
      try {
        await tick();
      } finally {
        busy = false;
        schedule(delay());
      }
    };
    const onVisibility = () => {
      if (!hidden()) schedule(0);
      else schedule(null);
    };
    document.addEventListener('visibilitychange', onVisibility);
    schedule(delay());
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!view?.matchId || view.phase === 'over') return undefined;
    const beat = setInterval(() => {
      pvpPost('pvp-action', {
        op: 'act',
        matchId: view.matchId,
        actionId: newActionId(),
        turn: view.turnNumber,
        version: view.version,
        intent: { type: 'heartbeat' },
      }).then((result) => {
        if (result?.view) setView(result.view);
      });
    }, 10000);
    return () => clearInterval(beat);
  }, [view?.matchId, view?.phase, view?.turnNumber, view?.version]);

  useEffect(() => {
    if (!view || view.phase !== 'over' || booked.current) return;
    booked.current = true;
    recordLiveBrawl({
      won: !!view.youWon,
      damage: view.self?.damage || 0,
      healing: view.self?.healing || 0,
      cards: view.self?.cards || 0,
      finalHP: view.self?.health ?? 0,
      night: view.night,
    });
  }, [view, recordLiveBrawl]);

  const send = async (intent) => {
    if (!view?.matchId) return;
    const result = await pvpPost('pvp-action', {
      op: 'act',
      matchId: view.matchId,
      actionId: newActionId(),
      turn: view.turnNumber,
      version: view.version,
      intent,
    });
    if (result?.error === 'stale' || result?.error === 'out_of_turn') {
      const sync = await pvpPost('pvp-action', { op: 'sync', matchId: view.matchId });
      if (sync?.view) setView(sync.view);
      setNotice(result.error === 'stale' ? 'The stool moved. Look again.' : 'Not your turn.');
      return;
    }
    if (result?.view) {
      setNotice('');
      setView(result.view);
      setAttackerId(null);
    } else if (result?.message) setNotice(result.message);
    else if (result?.error) setNotice('The bar refused that.');
  };

  const join = async () => {
    setNotice('');
    const result = await pvpPost('pvp-queue', { op: 'join', deck: deckIds, name: playerName });
    if (result?.view) {
      setView(result.view);
      setReveal(true);
      setQueue(null);
      return;
    }
    if (result?.ok) setQueue(result);
    else setNotice(result?.message || 'The queue did not take that.');
  };

  const leaveQueue = async () => {
    await pvpPost('pvp-queue', { op: 'leave' });
    setQueue(null);
  };

  const ghost = async () => {
    await leaveQueue();
    const drawn = await drawGhost();
    const ticket = ticketFrom(drawn);
    const cards = ticket ? cardsFor(ticket.deck) : null;
    const closed = cards && cards.some((card) => !isCardAvailable(card.id));
    if (ticket && cards && !closed && onGhost) onGhost(ticket);
    else setNotice(drawn?.reason === 'empty' || closed ? 'Nobody left a deck that is in season.' : 'No ghost on the bar.');
  };

  const createInvite = async (kind) => {
    const result = await pvpPost('pvp-invite', {
      op: 'create', deck: deckIds, name: playerName, kind, rule,
    });
    if (result?.code) setInvite(result.code);
    else setNotice(result?.message || 'No invite. Check the deck, and the gang.');
  };

  const accept = async () => {
    const result = await pvpPost('pvp-invite', {
      op: 'accept', code, deck: deckIds, name: playerName,
    });
    if (result?.view) {
      setView(result.view);
      setReveal(true);
    } else setNotice(result?.message || 'That invite is not open.');
  };

  useImperativeHandle(ref, () => ({
    requestLeave: async () => {
      const current = viewRef.current;
      if (current?.matchId && current.phase !== 'over') {
        await pvpPost('pvp-action', {
          op: 'act',
          matchId: current.matchId,
          actionId: newActionId(),
          turn: current.turnNumber,
          version: current.version,
          intent: { type: 'forfeit' },
        });
      } else if (queueRef.current) {
        await pvpPost('pvp-queue', { op: 'leave' });
      }
      onLeave?.();
    },
  }), [onLeave]);

  const clock = secondsLeft(view?.deadline, now);
  const yours = view && (view.phase === 'mulligan' ? !view.mulliganDone : view.turn === view.you);
  const pubLink = invite ? `https://terribleteddies.vercel.app/?pub=${invite}` : '';

  return (
    <div className="game-surface text-white" data-screen="pub">
      <h1 className="font-display text-3xl font-extrabold text-brass-200">Pub Brawl</h1>
      <p className="mt-1 max-w-xl text-sm text-plush-200">
        Live stools. The deck you saved is the only weapon. Gems stay in your pocket.
      </p>
      {notice && <p className="mt-3 text-sm text-orange-200" role="status">{notice}</p>}
      {offline && (
        <p className="mt-3 rounded-xl btn-glass px-3 py-2 text-sm" role="status">
          Connection dropped. Holding your stool. We keep asking.
        </p>
      )}

      {!view && !queue && (
        <section className="mt-6 max-w-xl space-y-4">
          <label className="block text-sm text-plush-200" htmlFor="pub-deck">Deck
            <select
              id="pub-deck"
              className={`mt-1 w-full min-h-11 rounded-xl bg-night-950 px-3 ${FOCUS_OUTLINE}`}
              value={deckIndex}
              onChange={(event) => setDeckIndex(Number(event.target.value))}
            >
              {decks.map((row, index) => (
                <option key={row.name} value={index}>{row.name}</option>
              ))}
            </select>
          </label>
          {deckError && <p className="text-sm text-orange-200">{deckError}</p>}
          <button type="button" className={`${btn} btn-brass`} onClick={join} disabled={!!deckError}>
            Take a stool
          </button>
          <div className="panel-glass rounded-2xl p-4 space-y-3">
            <p className="label-caps text-brass-200">A friend, or the gang</p>
            <label className="block text-sm text-plush-200" htmlFor="pub-rule">House rule for the invite
              <select
                id="pub-rule"
                className={`mt-1 w-full min-h-11 rounded-xl bg-night-950 px-3 ${FOCUS_OUTLINE}`}
                value={rule}
                onChange={(event) => setRule(event.target.value)}
              >
                {HOUSE_RULES.filter((row) => row.id !== 'boss').map((row) => (
                  <option key={row.id} value={row.id}>{row.label}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${btn} btn-glass`} onClick={() => createInvite('friend')} disabled={!!deckError}>
                Friend challenge
              </button>
              <button type="button" className={`${btn} btn-glass`} onClick={() => createInvite('gang')} disabled={!!deckError}>
                Gang challenge
              </button>
            </div>
            {pubLink && (
              <p className="break-all text-sm text-plush-100">
                Send this. <a className="underline" href={pubLink}>{pubLink}</a>
              </p>
            )}
            <label className="block text-sm text-plush-200" htmlFor="pub-code">Invite code
              <input
                id="pub-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={`mt-1 w-full min-h-11 rounded-xl bg-night-950 px-3 ${FOCUS_OUTLINE}`}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <button type="button" className={`${btn} btn-brass`} onClick={accept} disabled={!!deckError}>
              Sit at their table
            </button>
          </div>
        </section>
      )}

      {queue && !view && (
        <section className="mt-6 max-w-xl space-y-3" aria-live="polite">
          <h2 className="font-display text-2xl font-extrabold">Looking for a similar problem</h2>
          <p className="text-plush-200">Rated near {queue.rating || 'yours'}. The window gets wider the longer you wait.</p>
          {queue.offerGhost && (
            <button type="button" className={`${btn} btn-brass`} onClick={ghost}>
              Nobody human. Fight a ghost.
            </button>
          )}
          <button type="button" className={`${btn} btn-glass`} onClick={leaveQueue}>Leave the queue</button>
        </section>
      )}

      {view && reveal && (
        <section className="mt-6 max-w-xl panel-glass rounded-2xl p-5">
          <p className="label-caps text-brass-200">They sat down</p>
          <h2 className="font-display text-3xl font-extrabold">{view.opponent?.name}</h2>
          <p className="text-plush-200">Try to behave. The clock starts when the cards do.</p>
        </section>
      )}

      {view && !reveal && view.phase !== 'over' && (
        <section className="mt-4 max-w-3xl" data-turn={yours ? 'yours' : 'theirs'}>
          {(view.opponentAway || offline) && (
            <p className="mb-3 rounded-xl btn-glass px-3 py-2 text-sm" role="status">
              {offline
                ? 'You are back the moment this line goes. The hand stayed.'
                : 'They stepped out. The stool is held.'}
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-display text-xl font-extrabold">{view.opponent?.name}</div>
              <div className="text-sm text-plush-200">{view.opponent?.health} / {view.opponent?.maxHealth} · hand {view.opponent?.handCount}</div>
            </div>
            <div className="text-right">
              <div className="label-caps text-brass-200">{yours ? 'Your stool' : 'Their stool'}</div>
              <div className="font-display text-2xl tabular-nums" aria-live="polite">
                {clock === null ? '' : `${clock}s`}
              </div>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(view.opponent?.field || []).map((card) => (
              <li key={card.instanceId}>
                <button
                  type="button"
                  className={`${btn} btn-glass`}
                  disabled={!attackerId}
                  onClick={() => send({ type: 'attack', attackerId, targetId: card.instanceId })}
                >
                  Hit {card.name}
                </button>
              </li>
            ))}
            {attackerId && (
              <li>
                <button
                  type="button"
                  className={`${btn} btn-glass`}
                  onClick={() => send({ type: 'attack', attackerId, targetId: 'face' })}
                >
                  Hit their face
                </button>
              </li>
            )}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-2">
            {(view.self?.field || []).map((card) => (
              <li key={card.instanceId}>
                <button
                  type="button"
                  className={`${btn} ${attackerId === card.instanceId ? 'btn-brass' : 'btn-glass'}`}
                  onClick={() => setAttackerId(card.instanceId)}
                >
                  {card.name} {card.attack}/{card.currentHp}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-plush-200">Energy {view.self?.energy}. Momentum {view.self?.momentum}.</span>
            {view.phase === 'mulligan' && yours && (
              <>
                <button type="button" className={`${btn} btn-brass`} onClick={() => send({ type: 'mulligan', toss: [] })}>
                  Keep the hand
                </button>
                <button
                  type="button"
                  className={`${btn} btn-glass`}
                  onClick={() => send({
                    type: 'mulligan',
                    toss: (view.self?.hand || []).filter((card) => card.cost > 4).map((card) => card.instanceId),
                  })}
                >
                  Throw back the costly ones
                </button>
              </>
            )}
            {view.phase === 'main' && yours && (
              <button type="button" className={`${btn} btn-brass`} onClick={() => send({ type: 'end' })}>
                End turn
              </button>
            )}
            {view.legal?.rally && (
              <button type="button" className={`${btn} btn-glass`} onClick={() => send({ type: 'rally' })}>Rally</button>
            )}
            <button type="button" className={`${btn} btn-glass`} onClick={() => send({ type: 'forfeit' })}>
              Forfeit
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(view.self?.hand || []).map((card) => (
              <li key={card.instanceId}>
                <button type="button" className={`${btn} btn-glass`} onClick={() => send({ type: 'play', instanceId: card.instanceId })}>
                  Play {card.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Taunts">
            {TAUNTS.map((taunt) => (
              <button
                key={taunt.id}
                type="button"
                className={`${btn} btn-glass`}
                onClick={() => send({ type: 'emote', tauntId: taunt.id })}
              >
                {taunt.short}
              </button>
            ))}
          </div>
          {view.opponent?.taunt && (
            <p className="mt-3 text-sm text-plush-100" role="status">
              {TAUNTS.find((taunt) => taunt.id === view.opponent.taunt)?.line}
            </p>
          )}
          <ol className="mt-4 space-y-1 text-sm text-plush-300">
            {(view.log || []).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
          </ol>
        </section>
      )}

      {view && view.phase === 'over' && !reveal && (
        <section className="mt-6 max-w-xl space-y-3">
          <h2 className="font-display text-3xl font-extrabold">{view.youWon ? 'You drank them under the table.' : 'You are under it.'}</h2>
          <p>{mvpLine(view.mvp)}</p>
          {view.yourDelta !== null && view.yourDelta !== undefined && (
            <p className="text-plush-100">Ladder {view.yourDelta > 0 ? `+${view.yourDelta}` : view.yourDelta}.</p>
          )}
          <ol className="space-y-1 text-sm text-plush-300">
            {(view.log || []).slice(-6).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
          </ol>
          {view.matchId && (
            <p className="break-all text-sm">
              <a className="underline" href={slipUrl(view.matchId)}>The slip</a>
            </p>
          )}
          {view.matchId && (
            <button
              type="button"
              className={`${btn} btn-glass`}
              onClick={() => replayForMatch(view.matchId).then((found) => {
                if (found?.id) openReplay({ id: found.id });
                else setNotice('The tape is still being wound.');
              })}
            >
              Watch it back
            </button>
          )}
          <button type="button" className={`${btn} btn-brass`} onClick={onLeave}>Back to the bar</button>
        </section>
      )}
    </div>
  );
});

export default PubBrawl;
