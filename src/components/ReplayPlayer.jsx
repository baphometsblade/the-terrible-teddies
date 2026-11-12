import { useEffect, useState } from 'react';
import TeddyCard from '@/components/TeddyCard';
import { comboLine } from '@/lib/comboTalk';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { tauntLine } from '@/lib/social/taunts';
import { playLog } from '@/lib/replay/codec';
import { loadReplay, shareReplay, starReplay } from '@/lib/replay/client';
import { PUBLIC_ORIGIN } from '@/lib/social/ladder';
import { copyText } from '@/lib/social/victoryCard';

const btn = `inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 font-display font-bold ${FOCUS_OUTLINE}`;

function calloutFor(frames, index) {
  const frame = frames[index];
  if (!frame) return '';
  const line = frame.log?.[frame.log.length - 1] || '';
  const prev = frames[index - 1];
  if (prev) {
    const added = frame.log.slice(prev.log.length);
    const plays = added.filter((row) => row.includes(' plays ')).length;
    const hits = added.filter((row) => row.includes(' hits ') || row.includes(' unstuffs ')).length;
    if (plays >= 2) return comboLine('play');
    if (hits >= 2) return comboLine('swing');
    const taunt = frame.seats.a.taunt !== prev.seats.a.taunt
      ? tauntLine(frame.seats.a.taunt)
      : frame.seats.b.taunt !== prev.seats.b.taunt
        ? tauntLine(frame.seats.b.taunt)
        : null;
    if (taunt) return taunt;
  }
  return line;
}

function Row({ cards }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {cards.map((card) => (
        <li key={card.instanceId} className="w-24">
          <TeddyCard teddy={{ ...card, rarity: card.rarity || 'common' }} variant="board" />
        </li>
      ))}
    </ul>
  );
}

const ReplayPlayer = ({ target, onClose }) => {
  const [log, setLog] = useState(target?.log || null);
  const [meta, setMeta] = useState(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    if (target?.log) {
      setLog(target.log);
      return undefined;
    }
    loadReplay({ id: target?.id, code: target?.code }).then((result) => {
      if (!live) return;
      if (result?.log) {
        setLog(result.log);
        setMeta(result);
      } else setNotice(result?.error === 'incompatible'
        ? 'This night was dealt by an older engine. It will not play back.'
        : 'That night is not yours to watch.');
    });
    return () => { live = false; };
  }, [target]);

  const walked = log ? playLog(log) : null;
  const frames = walked?.ok ? walked.frames : [];
  const frame = frames[index];

  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 700 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, frames.length]);

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === ' ' && tag !== 'BUTTON') {
        event.preventDefault();
        setPlaying((on) => !on);
      } else if (event.key === 'ArrowRight') {
        setPlaying(false);
        setIndex((current) => Math.min(frames.length - 1, current + 1));
      } else if (event.key === 'ArrowLeft') {
        setPlaying(false);
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === '1') setSpeed(1);
      else if (event.key === '2') setSpeed(2);
      else if (event.key === '4') setSpeed(4);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length]);

  const step = (by) => {
    setPlaying(false);
    setIndex((current) => Math.max(0, Math.min(frames.length - 1, current + by)));
  };

  return (
    <div className="game-surface text-white" data-replay-root="" data-frame={index} role="dialog" aria-label="Watch it back">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold text-brass-200">Watch it back</h2>
        <button type="button" className={`${btn} btn-glass`} onClick={onClose}>Close</button>
      </div>
      {notice && <p className="mt-3 text-sm text-orange-200" role="status">{notice}</p>}
      {walked && !walked.ok && !notice && (
        <p className="mt-3 text-sm text-orange-200" role="status">
          {walked.error === 'incompatible'
            ? 'This night was dealt by an older engine. It will not play back.'
            : 'The log does not walk. Nothing was invented in its place.'}
        </p>
      )}
      {frame && (
        <div className="felt-table mt-4 rounded-2xl p-4">
          <p className="text-center text-sm text-plush-100">{frame.seats.b.name} · {frame.seats.b.health}</p>
          <Row cards={frame.seats.b.field} />
          <p className="my-3 text-center text-sm text-brass-200" role="status">{calloutFor(frames, index)}</p>
          <Row cards={frame.seats.a.field} />
          <p className="text-center text-sm text-plush-100">{frame.seats.a.name} · {frame.seats.a.health}</p>
          <div className="mt-3">
            <Row cards={frame.seats.a.hand} />
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} btn-brass`} onClick={() => setPlaying((on) => !on)}>
          {playing ? 'Pause' : 'Play the night'}
        </button>
        <button type="button" className={`${btn} btn-glass`} onClick={() => step(-1)}>Back a beat</button>
        <button type="button" className={`${btn} btn-glass`} onClick={() => step(1)}>On a beat</button>
        {[1, 2, 4].map((rate) => (
          <button
            key={rate}
            type="button"
            className={`${btn} ${speed === rate ? 'btn-brass' : 'btn-glass'}`}
            onClick={() => setSpeed(rate)}
          >
            {rate}x
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm text-plush-200" htmlFor="replay-scrub">
        Scrub the night
        <input
          id="replay-scrub"
          className="mt-1 block w-full min-h-11"
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={Math.min(index, Math.max(0, frames.length - 1))}
          onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)); }}
        />
      </label>
      {meta?.id && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`${btn} btn-glass`} onClick={() => starReplay(meta.id, !meta.starred).then(() => setMeta({ ...meta, starred: !meta.starred }))}>
            {meta.starred ? 'Starred' : 'Star it'}
          </button>
          <button type="button" className={`${btn} btn-glass`} onClick={() => shareReplay(meta.id, 'friends').then((result) => {
            if (result?.ok) setNotice('Your friends can watch this from their feed.');
          })}>
            Friends can watch
          </button>
          <button type="button" className={`${btn} btn-glass`} onClick={() => shareReplay(meta.id, 'public').then(async (result) => {
            if (!result?.code) return;
            const url = `${PUBLIC_ORIGIN}/?replay=${result.code}`;
            const copied = await copyText(url);
            setNotice(copied ? `Link copied. ${url}` : url);
          })}>
            Share the night
          </button>
        </div>
      )}
    </div>
  );
};

export default ReplayPlayer;
