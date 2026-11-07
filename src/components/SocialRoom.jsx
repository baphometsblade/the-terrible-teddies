import { useEffect, useState } from 'react';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { useGameStore, ALL_CARDS } from '@/stores/gameStore';
import { safeName, cleanCode, PUBLIC_ORIGIN } from '@/lib/social/ladder';
import { cardsFromIds } from '@/lib/social/ghostDeck';
import { cleanTag, cleanGangName, REPORT_REASONS } from '@/lib/social/room';
import { TAUNTS } from '@/lib/social/taunts';
import { copyText } from '@/lib/social/victoryCard';
import {
  loadRoom, loadFollows, loadGangs, loadCup, followPlayer, unfollowPlayer,
  createGang, joinGang, leaveGang, enterCup, drawCup, setGreeting, matchAside,
  setRival, clearRival, submitReport, redeemReferral, loadLineup, ticketFrom, reasonText,
} from '@/lib/social/client';

const btn = `inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-display font-bold ${FOCUS_OUTLINE}`;
const field = `mt-1 h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-3 text-plush-100 ${FOCUS_OUTLINE}`;

const startFrom = (ticket, onStart, setNotice, greeting) => {
  const cards = cardsFromIds(ticket.deck, ALL_CARDS);
  if (cards.length < 8) {
    setNotice('That deck did not survive the night.');
    return;
  }
  onStart({
    matchId: ticket.matchId,
    rivalName: safeName(ticket.rivalName, 'A rival'),
    label: safeName(ticket.label, 'Saved deck'),
    cards,
    greeting,
  });
};

const SocialRoom = ({ onStartBrawl }) => {
  const [room, setRoom] = useState(null);
  const [follows, setFollows] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [cup, setCup] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [gangName, setGangName] = useState('');
  const [gangTag, setGangTag] = useState('');
  const [joinTag, setJoinTag] = useState('');
  const [lineup, setLineup] = useState(null);

  const refresh = async () => {
    const [mine, people, houses, table] = await Promise.all([
      loadRoom(), loadFollows(), loadGangs(), loadCup(),
    ]);
    setRoom(mine);
    setFollows(people.rows || []);
    setGangs(houses.rows || []);
    setCup(table.rows || []);
  };

  useEffect(() => { refresh(); }, []);

  const run = async (work) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try { await work(); } finally { setBusy(false); }
  };

  const unavailable = room?.reason === 'unavailable';

  const onFollow = () => run(async () => {
    const clean = cleanCode(code);
    if (!clean) { setNotice('That is not a code.'); return; }
    const result = await followPlayer(clean);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice('You are watching them now. Try not to be weird.');
    await refresh();
  });

  const onRival = () => run(async () => {
    const clean = cleanCode(code);
    if (!clean) { setNotice('That is not a code.'); return; }
    const result = await setRival(clean);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice('Rival marked. They will hear about it. Eventually.');
    await refresh();
  });

  const onReport = (reason) => run(async () => {
    const clean = cleanCode(code);
    if (!clean) { setNotice('That is not a code.'); return; }
    const result = await submitReport(clean, reason);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice('The bar has it. They do not get a copy.');
  });

  const onLineup = () => run(async () => {
    const clean = cleanCode(code);
    if (!clean) { setNotice('That is not a code.'); return; }
    const result = await loadLineup(clean);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    const ids = Array.isArray(result.deck) ? result.deck.map(Number) : [];
    const owned = new Set(useGameStore.getState().ownedCards);
    const cards = cardsFromIds(ids, ALL_CARDS);
    const keep = cards.filter((card) => owned.has(card.id)).map((card) => card.id);
    setLineup({ name: result.username, cards, keep });
  });

  const onKeep = () => {
    if (!lineup) return;
    useGameStore.getState().saveDeck('Borrowed lineup', lineup.keep);
    setNotice(lineup.keep.length
      ? `Kept ${lineup.keep.length} you already own. The rest stay theirs.`
      : 'You do not own a single one. Tragic.');
  };

  const onRefer = () => run(async () => {
    const clean = cleanCode(code);
    if (!clean) { setNotice('That is not a code.'); return; }
    const result = await redeemReferral(clean);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice(`The bar slipped you ${result.bonus} rating. Do not spend it all in one place.`);
    await refresh();
  });

  const onGang = () => run(async () => {
    const name = cleanGangName(gangName);
    const tag = cleanTag(gangTag);
    if (!name || !tag) { setNotice('A gang needs a name and a 3 or 4 letter tag.'); return; }
    const result = await createGang(name, tag);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice(`${tag} is yours. Try to deserve it.`);
    await refresh();
  });

  const onJoin = () => run(async () => {
    const tag = cleanTag(joinTag);
    if (!tag) { setNotice('A tag is 3 or 4 letters.'); return; }
    const result = await joinGang(tag);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice(`You are in ${tag}. Act like it.`);
    await refresh();
  });

  const onCup = () => run(async () => {
    const entered = await enterCup();
    if (entered.ok === false) { setNotice(reasonText(entered)); return; }
    const result = await drawCup();
    const ticket = ticketFrom(result);
    if (!ticket) { setNotice(reasonText(result)); return; }
    const aside = await matchAside(ticket.matchId);
    startFrom(ticket, onStartBrawl, setNotice, aside?.greeting);
  });

  const onGreet = (id) => run(async () => {
    const result = await setGreeting(id);
    if (result.ok === false) { setNotice(reasonText(result)); return; }
    setNotice('That is what they hear when they sit down.');
    await refresh();
  });

  const copyRefer = () => run(async () => {
    const url = room?.referral_code ? `${PUBLIC_ORIGIN}/?refer=${room.referral_code}` : '';
    if (!url) { setNotice('Open the ladder once so the bar can write you a code.'); return; }
    const ok = await copyText(url);
    setNotice(ok ? 'Invite copied. Send it to someone who owes you.' : url);
  });

  if (unavailable) {
    return <p className="text-plush-200">The back room is not open on this server yet.</p>;
  }

  return (
    <div className="space-y-6">
      {notice && <p role="status" className="text-sm text-plush-200">{notice}</p>}

      <section>
        <h3 className="label-caps text-plush-300">Ribbon</h3>
        <p className="mt-2 text-plush-100">
          {room?.ribbon ? `${room.ribbon}. From ${room.ribbon_season}.` : 'Play a week and Monday leaves you something.'}
        </p>
      </section>

      <section>
        <h3 className="label-caps text-plush-300">Your rival</h3>
        {room?.rival ? (
          <p className="mt-2 text-sm text-plush-100">
            {safeName(room.rival.username, 'A rival')}. You {room.rival.wins}, them {room.rival.losses}.
            <button type="button" onClick={() => run(async () => { await clearRival(); await refresh(); })} className={`${btn} btn-glass ml-0 mt-2 w-full`}>
              Drop them
            </button>
          </p>
        ) : <p className="mt-2 text-sm text-plush-200">Nobody yet. Pick someone whose deck you cannot stop thinking about.</p>}
      </section>

      <section>
        <h3 className="label-caps text-plush-300">A code</h3>
        <label className="block text-sm text-plush-200" htmlFor="room-code">
          Their challenge code
          <input id="room-code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={40} className={field} />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={onFollow} disabled={busy} className={`${btn} btn-brass`}>Follow</button>
          <button type="button" onClick={onRival} disabled={busy} className={`${btn} btn-glass`}>Make them the rival</button>
          <button type="button" onClick={onLineup} disabled={busy} className={`${btn} btn-glass`}>Peek at the lineup</button>
          <button type="button" onClick={onRefer} disabled={busy} className={`${btn} btn-glass`}>Cash a referral</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {REPORT_REASONS.map((reason) => (
            <button key={reason.id} type="button" onClick={() => onReport(reason.id)} disabled={busy} className={`${btn} btn-glass`}>
              {reason.label}
            </button>
          ))}
        </div>
        {lineup && (
          <div className="mt-3">
            <p className="text-sm text-plush-100">{safeName(lineup.name, 'Someone')} left these out.</p>
            <ul className="mt-2 space-y-1 text-sm text-plush-200">
              {lineup.cards.map((card) => <li key={card.instanceId}>{card.name}</li>)}
            </ul>
            <button type="button" onClick={onKeep} className={`${btn} btn-brass mt-3`}>Keep what you own</button>
          </div>
        )}
      </section>

      <section>
        <h3 className="label-caps text-plush-300">Who you follow</h3>
        {follows.length === 0 && <p className="mt-2 text-sm text-plush-200">Nobody. The stool next to you is free.</p>}
        <ul className="mt-2 space-y-2">
          {follows.map((row) => (
            <li key={row.code || row.username} className="flex min-h-11 items-center justify-between gap-2 rounded-xl btn-glass px-3">
              <span className="min-w-0 truncate font-display font-bold text-white">{row.username}</span>
              <span className="shrink-0 text-xs text-plush-200">{row.tier} · {row.rating}</span>
              <button type="button" className={`${btn} btn-glass px-3`} onClick={() => run(async () => { await unfollowPlayer(row.code); await refresh(); })}>Drop</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="label-caps text-plush-300">Your gang</h3>
        {room?.gang ? (
          <div className="mt-2">
            <p className="text-plush-100">{room.gang.tag} · {room.gang.name}. {room.gang.members} in the booth.</p>
            <button type="button" onClick={() => run(async () => { await leaveGang(); await refresh(); })} className={`${btn} btn-glass mt-2`}>Leave the gang</button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <label className="block text-sm text-plush-200" htmlFor="gang-name">Name
              <input id="gang-name" value={gangName} onChange={(e) => setGangName(e.target.value)} maxLength={20} className={field} />
            </label>
            <label className="block text-sm text-plush-200" htmlFor="gang-tag">Tag
              <input id="gang-tag" value={gangTag} onChange={(e) => setGangTag(e.target.value)} maxLength={4} autoCapitalize="characters" className={field} />
            </label>
            <button type="button" onClick={onGang} disabled={busy} className={`${btn} btn-brass w-full`}>Start a gang</button>
            <label className="block text-sm text-plush-200" htmlFor="gang-join">Join one
              <input id="gang-join" value={joinTag} onChange={(e) => setJoinTag(e.target.value)} maxLength={4} className={field} />
            </label>
            <button type="button" onClick={onJoin} disabled={busy} className={`${btn} btn-glass w-full`}>Join that tag</button>
          </div>
        )}
        <ol className="mt-3 space-y-2">
          {gangs.map((row) => (
            <li key={row.tag} className="flex min-h-11 items-center gap-3 rounded-xl btn-glass px-3">
              <span className="w-8 font-display font-extrabold tabular-nums">{row.place}</span>
              <span className="min-w-0 flex-1 truncate font-display font-bold text-white">{row.tag} · {row.name}</span>
              <span className="text-xs text-plush-200">{row.members} · {row.rating}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="label-caps text-plush-300">Last Call Cup</h3>
        <p className="mt-2 text-sm text-plush-200">
          Three dances this week, against whoever entered and left a deck. {room?.cup?.played ?? 0} of 3 done.
        </p>
        <button type="button" onClick={onCup} disabled={busy} className={`${btn} btn-brass mt-2 w-full`}>
          {room?.cup?.entered ? 'Draw the next dance' : 'Enter, then dance'}
        </button>
        <ol className="mt-3 space-y-2">
          {cup.map((row) => (
            <li key={`${row.place}-${row.username}`} className="flex min-h-11 items-center gap-3 rounded-xl btn-glass px-3">
              <span className="w-8 font-display font-extrabold tabular-nums">{row.place}</span>
              <span className="min-w-0 flex-1 truncate font-display font-bold text-white">{row.username}</span>
              <span className="text-xs text-plush-200">{row.wins} wins · {row.played} played</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="label-caps text-plush-300">What you say when they sit</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TAUNTS.map((taunt) => (
            <button key={taunt.id} type="button" onClick={() => onGreet(taunt.id)} disabled={busy} aria-pressed={room?.greeting === taunt.id} className={`${btn} ${room?.greeting === taunt.id ? 'btn-brass' : 'btn-glass'} w-full`}>
              {taunt.short}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="label-caps text-plush-300">Bring someone</h3>
        <p className="mt-2 text-sm text-plush-200">They fight once, then cash the code. You both get a little rating. Five a week, and not yourself.</p>
        <button type="button" onClick={copyRefer} disabled={busy} className={`${btn} btn-glass mt-2 w-full`}>Copy the invite</button>
        {room?.referral_code && <p className="mt-2 break-all text-xs text-plush-300">{room.referral_code}</p>}
      </section>
    </div>
  );
};

export default SocialRoom;
