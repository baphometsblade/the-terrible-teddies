import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Trophy, Link2, Share2, Download } from 'lucide-react';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { Medallion, DialogClose } from '@/components/ui/game-chrome';
import { useGameStore, ALL_CARDS } from '@/stores/gameStore';
import { deckProblem, challengeUrl, safeName, cleanCode, TIER_ASIDES } from '@/lib/social/ladder';
import { toLadderId as toHenDo } from '@/data/henDoHavoc';
import { toLadderId as toLastOrders } from '@/data/expansion-last-orders';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { collectiblePool } from '@/lib/seasons';
import {
  loadSocial, loadWeekly, loadCard, publishGhost, drawGhost, openChallenge, forfeitOpen, ticketFrom, reasonText, slipUrl,
  loadFriendGhosts, loadFriendsBoard, challengeFriend,
} from '@/lib/social/client';
import SocialRoom from './SocialRoom';
import {
  CARD_W, CARD_H, victorySpec, drawVictoryCard, canvasBlob, shareCard, saveBlob, copyText,
} from '@/lib/social/victoryCard';

const knownNow = () => new Set(collectiblePool(ALL_CARDS).map((card) => card.id));

const TABS = [
  { id: 'card', label: 'Card', name: 'Your card' },
  { id: 'week', label: 'Week', name: 'This week' },
  { id: 'brawl', label: 'Brawl', name: 'Brawls' },
  { id: 'room', label: 'Room', name: 'The room' },
];

const btn = `inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-display font-bold ${FOCUS_OUTLINE}`;

const SocialHouse = ({ onClose, onStartBrawl, initialCode = '', initialTab = '', receipt = null }) => {
  const dialogRef = useDialog(onClose);
  const bodyRef = useRef(null);
  const canvasRef = useRef(null);
  const specRef = useRef(null);
  const [tab, setTab] = useState(initialCode ? 'brawl' : (initialTab || 'card'));
  const [mine, setMine] = useState(null);
  const [week, setWeek] = useState([]);
  const [weekOf, setWeekOf] = useState('house');
  const [friendsWeek, setFriendsWeek] = useState([]);
  const [ghosts, setGhosts] = useState([]);
  const [weekError, setWeekError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [rival, setRival] = useState(null);

  const refresh = useCallback(async () => {
    const [standing, board, palBoard, palGhosts] = await Promise.all([
      loadSocial(), loadWeekly(), loadFriendsBoard(), loadFriendGhosts(),
    ]);
    setMine(standing);
    setWeek(board.rows || []);
    setFriendsWeek(palBoard.rows || []);
    setGhosts(palGhosts.rows || []);
    setWeekError(board.error || (board.unavailable ? reasonText({ reason: 'unavailable' }) : null));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh, receipt]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab, rival]);

  useEffect(() => {
    const clean = cleanCode(initialCode);
    if (!clean) return undefined;
    let gone = false;
    loadCard(clean).then((result) => {
      if (gone) return;
      if (result.card) setRival(result.card);
    });
    return () => { gone = true; };
  }, [initialCode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mine || mine.ok === false) return;
    const spec = victorySpec({
      name: mine.username,
      won: receipt?.ok ? receipt.won : null,
      tier: receipt?.ok ? receipt.tier : mine.tier,
      rating: receipt?.ok ? receipt.rating : mine.rating,
      rivalName: receipt?.rival_name,
    });
    specRef.current = spec;
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    canvas.setAttribute('aria-label', spec.aria);
    drawVictoryCard(canvas.getContext('2d'), spec);
  }, [mine, receipt]);

  const deal = (ticket) => {
    const cards = cardsFromIds(ticket.deck, collectiblePool(ALL_CARDS));
    if (cards.length < 8) {
      setNotice('That deck did not survive the night.');
      return;
    }
    onStartBrawl({
      matchId: ticket.matchId,
      rivalName: safeName(ticket.rivalName, 'A rival'),
      label: safeName(ticket.label, 'Saved deck'),
      cards,
    });
  };

  const run = async (work) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const onPublish = () => run(async () => {
    const ids = useGameStore.getState().currentDeck;
    const problem = deckProblem(ids, knownNow());
    if (problem) { setNotice(problem); return; }
    const stored = ids.map((id) => toLastOrders(toHenDo(id)));
    const result = await publishGhost(stored, 'Saved deck');
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice('On the bar. Try not to hover.');
    await refresh();
  });

  const onCopy = () => run(async () => {
    const absolute = challengeUrl(mine?.code);
    if (!absolute) { setNotice('Leave a deck on the bar first.'); return; }
    const ok = await copyText(absolute);
    setNotice(ok ? 'Dare copied. Send it to someone with terrible judgment.' : absolute);
  });

  const onFriendGhost = (row) => run(async () => {
    const result = await challengeFriend(row.user_id, 'ghost');
    const ticket = result.ticket || ticketFrom(result);
    if (!ticket) { setNotice(reasonText(result)); return; }
    deal(ticket);
  });

  const onDraw = () => run(async () => {
    const result = await drawGhost();
    const ticket = ticketFrom(result);
    if (!ticket) { setNotice(reasonText(result)); return; }
    if (ticket.resume) setNotice('They kept it warm for you.');
    deal(ticket);
  });

  const onCode = () => run(async () => {
    const clean = cleanCode(code);
    if (!clean) { setNotice('That is not a challenge code.'); return; }
    const result = await openChallenge(clean);
    const ticket = ticketFrom(result);
    if (!ticket) { setNotice(reasonText(result)); return; }
    deal(ticket);
  });

  const onForfeit = () => run(async () => {
    const result = await forfeitOpen();
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice('You walked. Booked as a loss.');
    await refresh();
  });

  const onShare = () => run(async () => {
    const spec = specRef.current;
    const blob = await canvasBlob(canvasRef.current);
    if (!spec || !blob) { setNotice('The card could not be drawn.'); return; }
    const how = await shareCard(blob, spec);
    if (how === 'download') saveBlob(blob, spec.fileName);
    if (how === 'shared' || how === 'shared-text') setNotice('Sent. Let them squirm.');
    else if (how === 'download') setNotice('Press and hold the card if it did not save.');
  });

  const onSave = () => run(async () => {
    const spec = specRef.current;
    const blob = await canvasBlob(canvasRef.current);
    if (!spec || !blob) { setNotice('The card could not be drawn.'); return; }
    saveBlob(blob, spec.fileName);
    setNotice('Press and hold the card if it did not save.');
  });

  const openRival = (row) => run(async () => {
    if (!row.code) { setNotice('They have not left anything out.'); return; }
    const result = await loadCard(row.code);
    if (!result.card) { setNotice(result.error || reasonText({ reason: 'missing' })); return; }
    setRival(result.card);
    setCode(row.code);
  });

  const fightRival = () => run(async () => {
    const clean = cleanCode(code);
    if (!clean) return;
    const result = await openChallenge(clean);
    const ticket = ticketFrom(result);
    if (!ticket) { setNotice(reasonText(result)); return; }
    deal(ticket);
  });

  const standing = mine && mine.ok !== false ? mine : null;
  const aside = standing ? TIER_ASIDES[standing.tier] : null;
  const unavailable = mine?.reason === 'unavailable' || weekError === reasonText({ reason: 'unavailable' });

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="The ladder"
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl dialog-panel [@media(min-height:600px)]:max-h-[calc(100dvh-1.5rem)] sm:[@media(min-height:600px)]:max-h-[calc(100dvh-3rem)]"
      >
        <div className="relative flex items-center gap-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <Medallion icon={Swords} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-none text-brass-gradient sm:text-3xl">
              The ladder
            </h2>
            <p className="label-caps mt-1.5 text-plush-300">Who finished. Who went home.</p>
          </div>
          <DialogClose label="Close the ladder" onClick={onClose} />
        </div>

        <div className="seg-well relative mx-4 mb-3 grid grid-cols-4 gap-1 sm:mx-6" role="tablist" aria-label="Ladder sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`ladder-tab-${item.id}`}
              aria-label={item.name}
              aria-selected={tab === item.id}
              aria-controls={`ladder-panel-${item.id}`}
              onClick={() => { setTab(item.id); setRival(null); }}
              className={`h-11 rounded-lg text-sm font-bold ${tab === item.id ? 'seg-on' : 'seg-off'} ${FOCUS_OUTLINE}`}
            >
              <span className="sm:hidden">{item.label}</span>
              <span className="hidden sm:inline">{item.name}</span>
            </button>
          ))}
        </div>

        <div
          ref={bodyRef}
          id={`ladder-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`ladder-tab-${tab}`}
          className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6"
        >
          <div role="status" className="mb-3 text-sm text-plush-200">
            {loading && <p>Counting who went home.</p>}
            {!loading && notice && <p>{notice}</p>}
            {!loading && !notice && receipt?.ok && (
              <div>
                <p>
                  {receipt.won ? 'You finished.' : 'They finished.'}
                  {' '}
                  {receipt.delta > 0 ? `+${receipt.delta}` : receipt.delta} on the ladder.
                  {' '}
                  Now {receipt.tier}, {receipt.rating}.
                </p>
                {slipUrl(receipt.match_id) && (
                  <button
                    type="button"
                    onClick={() => run(async () => {
                      const url = slipUrl(receipt.match_id);
                      const ok = await copyText(url);
                      setNotice(ok ? 'Slip copied. The filthy version stays here.' : url);
                    })}
                    className={`${btn} btn-glass mt-2`}
                  >
                    Copy the slip
                  </button>
                )}
              </div>
            )}
          </div>

          {!loading && unavailable && (
            <p className="text-plush-200">The ladder is not open on this server yet.</p>
          )}

          {!loading && !unavailable && tab === 'card' && standing && (
            <div>
              <p className="font-display text-2xl font-extrabold text-white">{standing.tier}</p>
              <p className="mt-1 text-sm text-plush-200">{aside}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Rating" value={standing.rating} />
                <Stat label="Week" value={`${standing.week_wins}-${standing.week_losses}`} />
                <Stat label="Peak" value={standing.peak_rating} />
              </dl>
              <p className="mt-3 text-xs text-plush-300">
                Nights {standing.wins}-{standing.losses}.
                {standing.day_room === 0 ? ' The bar has cut you off until tomorrow. Losses still count.' : ` ${standing.day_room} more to gain before the bar cuts you off.`}
              </p>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="Ladder card"
                className="mt-4 h-auto w-full max-w-xs rounded-xl"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={onShare} disabled={busy} className={`${btn} btn-brass`}>
                  <Share2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                  Show it off
                </button>
                <button type="button" onClick={onSave} disabled={busy} className={`${btn} btn-glass`}>
                  <Download aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                  Keep the picture
                </button>
              </div>
            </div>
          )}

          {!loading && !unavailable && tab === 'week' && !rival && (
            <div>
              <div className="seg-well mb-3 grid grid-cols-2 gap-1" role="tablist" aria-label="Whose week">
                <button
                  type="button"
                  role="tab"
                  aria-selected={weekOf === 'house'}
                  onClick={() => setWeekOf('house')}
                  className={`h-11 rounded-lg text-sm font-bold ${weekOf === 'house' ? 'seg-on' : 'seg-off'} ${FOCUS_OUTLINE}`}
                >
                  The house
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={weekOf === 'friends'}
                  onClick={() => setWeekOf('friends')}
                  className={`h-11 rounded-lg text-sm font-bold ${weekOf === 'friends' ? 'seg-on' : 'seg-off'} ${FOCUS_OUTLINE}`}
                >
                  Friends
                </button>
              </div>
              {weekOf === 'house' && weekError && <p className="text-plush-200">{weekError}</p>}
              {(weekOf === 'house' ? week : friendsWeek).length === 0 && !(weekOf === 'house' && weekError) && (
                <p className="text-plush-200">
                  {weekOf === 'friends'
                    ? 'Quiet among your pals. Drag one in.'
                    : 'Quiet week. Leave a deck out and ruin it.'}
                </p>
              )}
              <ol className="space-y-2">
                {(weekOf === 'house' ? week : friendsWeek).map((row) => (
                  <li key={`${row.place}-${row.username}`}>
                    <button
                      type="button"
                      onClick={() => openRival(row)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left btn-glass ${row.is_me ? 'border-2 border-brass-300' : ''} ${FOCUS_OUTLINE}`}
                    >
                      <span className="w-8 shrink-0 font-display font-extrabold tabular-nums">{row.place}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display font-bold text-white">
                          {row.username}
                          {row.is_me && <span className="sr-only"> (you)</span>}
                        </span>
                        <span className="block truncate text-xs text-plush-200">{row.tier}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-display font-extrabold tabular-nums text-white">{row.rating}</span>
                        <span className="block text-xs tabular-nums text-plush-200">
                          {row.week_delta > 0 ? `+${row.week_delta}` : row.week_delta} this week
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!loading && rival && tab === 'week' && (
            <div>
              <button type="button" onClick={() => setRival(null)} className={`${btn} btn-glass mb-4`}>
                Back to the week
              </button>
              <h3 className="font-display text-2xl font-extrabold text-white">{safeName(rival.username, 'A rival')}</h3>
              <p className="mt-1 text-plush-200">{rival.tier} · {rival.rating}</p>
              <p className="mt-2 text-sm text-plush-300">
                Nights {rival.wins}-{rival.losses}. This week {rival.week_wins}-{rival.week_losses}. Have a go, if you are that sort.
              </p>
              {!rival.is_me && (
                <button type="button" onClick={fightRival} disabled={busy} className={`${btn} btn-brass mt-4 w-full`}>
                  <Swords aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                  Have a go
                </button>
              )}
            </div>
          )}

          {!loading && !unavailable && tab === 'room' && (
            <SocialRoom onStartBrawl={onStartBrawl} />
          )}

          {!loading && !unavailable && tab === 'brawl' && (
            <div className="space-y-3">
              <p className="text-sm text-plush-200">
                Park the deck you came with. Strangers will have a go while you are out. One finish a ticket. The bar does the sums, and the till keeps its hands to itself.
              </p>
              {standing?.open_match?.match_id && (
                <div className="panel-glass rounded-xl p-3">
                  <p className="text-sm text-plush-100">
                    Half-finished against {safeName(standing.open_match.rival_name, 'a rival')}. Rude to leave it like that.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const ticket = ticketFrom(standing.open_match);
                        if (ticket) deal(ticket);
                      }}
                      className={`${btn} btn-brass`}
                    >
                      Finish it
                    </button>
                    <button type="button" onClick={onForfeit} disabled={busy} className={`${btn} btn-glass`}>
                      Call it a loss
                    </button>
                  </div>
                </div>
              )}
              <button type="button" onClick={onPublish} disabled={busy} className={`${btn} btn-brass w-full`}>
                <Trophy aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                Leave it on the bar
              </button>
              <button type="button" onClick={onCopy} disabled={busy || !standing?.code} className={`${btn} btn-glass w-full`}>
                <Link2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                Copy the dare
              </button>
              {standing?.code && (
                <p className="break-all text-xs text-plush-300">{standing.code}</p>
              )}
              {ghosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-plush-200">Pals left these out. Strangers can wait.</p>
                  {ghosts.map((row) => (
                    <button
                      key={row.user_id}
                      type="button"
                      onClick={() => onFriendGhost(row)}
                      disabled={busy}
                      className={`${btn} btn-glass w-full justify-between`}
                    >
                      <span className="truncate">{safeName(row.username, 'A pal')}</span>
                      <span className="shrink-0 text-xs">{row.tier}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={onDraw} disabled={busy} className={`${btn} btn-glass w-full`}>
                <Swords aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                A stranger
              </button>
              <label className="block text-sm text-plush-200" htmlFor="challenge-code">
                Their code
                <input
                  id="challenge-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  maxLength={16}
                  className={`mt-1 h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-3 text-plush-100 ${FOCUS_OUTLINE}`}
                />
              </label>
              <button type="button" onClick={onCode} disabled={busy} className={`${btn} btn-glass w-full`}>
                Take this code
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="panel-glass rounded-xl px-2 py-3">
    <div className="font-display text-xl font-extrabold tabular-nums text-white">{value}</div>
    <div className="label-caps mt-1 text-plush-300">{label}</div>
  </div>
);

export default SocialHouse;
